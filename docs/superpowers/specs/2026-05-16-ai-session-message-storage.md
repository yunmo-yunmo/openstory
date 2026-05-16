# OpenStory AI Session Message Storage

**Date:** 2026-05-16
**Status:** Current

OpenStory stores AI chat history in append-only `AISessionMessage` rows. The older `AISession.messages` JSON field remains as a legacy compatibility source so existing local databases can still read pre-migration conversations.

## Reference

### Data Model

`AISession` owns session metadata:

```prisma
model AISession {
  id        String   @id @default(cuid())
  projectId String
  chapterId String?
  title     String?
  messages  String   @default("[]") // legacy JSON array
  toolState String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessionMessages AISessionMessage[]
}
```

`AISessionMessage` stores the normalized chat log:

```prisma
model AISessionMessage {
  id        Int      @id @default(autoincrement())
  sessionId String
  role      String
  content   String
  metadata  Json?
  createdAt DateTime @default(now())

  session AISession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, id])
}
```

Fields:

| Field | Meaning |
|---|---|
| `id` | Database-assigned append order. Message queries sort by `id asc`. |
| `sessionId` | Owning AI session. Rows cascade when the session is deleted. |
| `role` | Message role, such as `user` or `assistant`. |
| `content` | Plain message text sent to or returned by the assistant. |
| `metadata` | Optional message extras such as `toolCalls`, `toolResults`, or `proposalId`. |
| `createdAt` | Insert timestamp for auditing and debugging. |

### Server Helpers

`src/server/ai/session-turn.ts` owns message conversion and persistence:

| Helper | Purpose |
|---|---|
| `parseStoredSessionMessages(raw)` | Parses legacy `AISession.messages` JSON and filters malformed entries. |
| `readSessionMessages({ db, sessionId, legacyMessages })` | Returns legacy JSON messages followed by normalized `AISessionMessage` rows. |
| `appendSessionMessages({ db, userId, sessionId, titleSeed, messages })` | Appends new message rows and touches the parent `AISession.updatedAt`. |

`appendSessionMessages` verifies the session through project ownership before writing. It initializes the session title from `titleSeed` only when the title is empty.

### API Behavior

The public API shape is intentionally stable:

- `session.getById` still returns `messages` as an ordered array.
- `session.send` appends the user and assistant messages as `AISessionMessage` rows.
- `/api/chat/stream` appends the user and assistant messages after the stream closes.
- Tool metadata and revision proposal IDs are stored in `AISessionMessage.metadata`, then merged back into the returned message objects.

## Explanation

### The Problem

The original implementation stored the whole chat log as a JSON string on `AISession.messages`. Sending a message required reading the JSON array, pushing new entries, and writing the full string back. That worked for one active client, but two tabs or devices sending to the same session could overwrite each other's turns.

### The Approach

New turns are now append-only rows:

```text
session.send or /api/chat/stream
  -> read legacy JSON + AISessionMessage rows for model context
  -> call LLM
  -> append user/assistant rows
  -> update parent AISession.updatedAt
```

The parent session still holds metadata used by the sidebar, including `title`, `projectId`, `chapterId`, and `updatedAt`. Message content lives in `AISessionMessage`.

### Trade-offs

This design makes concurrent appends safer because each message insert is its own row and ordering is assigned by SQLite. It also keeps old conversations readable without requiring an immediate backfill.

The trade-off is that reads now combine two sources until legacy JSON is retired. A future cleanup can backfill old JSON messages into `AISessionMessage`, clear or deprecate `AISession.messages`, and simplify `readSessionMessages`.

## How To Work With Session Messages

### Add New Message Metadata

1. Add fields to the `StoredSessionMessage` object before calling `appendSessionMessages`.

   ```ts
   const assistantMessage = {
     role: "assistant",
     content: result.text ?? "",
     toolCalls: result.toolCalls,
     toolResults: result.toolResults,
   };
   ```

2. Do not add columns for one-off assistant metadata unless it needs independent querying. Metadata is merged into `AISessionMessage.metadata`.

3. Verify with:

   ```bash
   npm run test -- src/server/ai/session-turn.test.ts
   npm run typecheck
   ```

### Read Session History

Use `readSessionMessages`; do not parse `AISession.messages` directly in new code.

```ts
const messages = await readSessionMessages({
  db,
  sessionId: session.id,
  legacyMessages: session.messages,
});
```

This preserves old local data and includes new append-only rows in the same array.

### Migrate The Remaining Legacy Field Later

The current migration intentionally does not backfill old JSON messages. A later cleanup should:

1. Read sessions with non-empty `AISession.messages`.
2. Insert their parsed entries into `AISessionMessage` in array order.
3. Make the read path prefer normalized rows after backfill verification.
4. Update docs and tests.
5. Only then consider removing or ignoring the legacy JSON field.

## Related

- [API Reference](../../api.md#session)
- [AI Session Turn Module Plan](../plans/2026-05-15-ai-session-turn-module.md)
- [Current AI System Design](2026-05-08-openstory-ai-novel-tool-design.md)
