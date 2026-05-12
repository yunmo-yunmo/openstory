# OpenStory — AI Inline Revision Proposals Design

**Date:** 2026-05-12
**Status:** Approved for implementation planning

## Summary

OpenStory's next product step is to move AI from "chat beside the editor" into the writing workflow without giving it direct control over the manuscript.

This spec defines a narrow first version of **AI inline revision proposals**:

1. The author asks for a writing change from the right-side chat.
2. The AI generates a structured chapter revision proposal.
3. The proposal is shown in the chat as a reviewable card.
4. The author accepts or rejects it.
5. Only accepted proposals write back to the current chapter.

The first version supports appending new prose and replacing a conservatively matched text range. It does not introduce editor selection, slash commands, TipTap toolbar work, visual diffs, multiple candidates, or streaming output.

## Goals

- Let authors ask the AI to continue, rewrite, polish, expand, or shorten prose from the existing chat panel.
- Prevent AI from directly mutating chapter content during generation.
- Show every proposed manuscript change before it can be applied.
- Support safe `append` and conservative `replace` operations.
- Persist pending proposals so refreshes do not lose them.
- Reuse existing chapter save behavior: word count, snapshots, and background agents.
- Establish a durable protocol for future AI writing features.

## Non-Goals

- No editor text selection integration.
- No `/continue` or slash command menu.
- No TipTap-rich-text editing work.
- No inline visual diff beyond original/new text blocks.
- No multiple AI candidates per instruction.
- No streaming proposal generation.
- No AI quality scoring. Tests verify structure, safety, and write behavior, not literary quality.

## User Flow

### Append Flow

1. The author opens a chapter and starts or selects an AI session.
2. The author sends a chat message such as: "续写这一章".
3. The assistant responds with a short explanation and an `append` proposal card.
4. The card previews the text that will be appended.
5. The author clicks `Accept`.
6. The server appends the text to the chapter, updates metadata, creates a snapshot, and triggers background agents.
7. The editor refreshes with the new prose.

### Replace Flow

1. The author sends a chat message such as: "把最后三段润色一下".
2. The assistant generates a structured `replace` draft with `originalText` and `replacementText`.
3. The server verifies that `originalText` appears exactly once in the current chapter plain text and is long enough to avoid accidental matches.
4. If verification succeeds, the chat shows a proposal card with the matched original text and replacement text.
5. The author clicks `Accept`.
6. The server revalidates against the current chapter before writing.
7. The matching text is replaced, chapter metadata is updated, and the proposal becomes accepted.

### Uncertain Replace Flow

If the server cannot identify a safe replacement range, it does not create a proposal. The assistant returns normal advice or a draft text response without an accept button.

## Data Model

Add a new persistent model:

```prisma
model ChapterRevisionProposal {
  id              String   @id @default(cuid())
  projectId       String
  chapterId       String
  sessionId       String?
  status          String   @default("pending") // pending | accepted | rejected | expired
  operation       String   // append | replace
  instruction     String
  targetHint      String?
  originalText    String?
  replacementText String
  baseContentHash String
  createdAt       DateTime @default(now())
  decidedAt       DateTime?

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  chapter Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  session AISession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  @@index([projectId])
  @@index([chapterId])
  @@index([sessionId])
  @@index([status])
}
```

The `Project`, `Chapter`, and `AISession` models need matching relation fields.

Why this should be its own model instead of only JSON inside `AISession.messages`:

- Pending proposals survive page refresh.
- Accept/reject status is queryable.
- Conflict checks can compare against `baseContentHash`.
- Future "AI edit history" can build on the same record type.
- Chat message JSON remains a message log, not the source of truth for manuscript mutations.

## API Design

Add a new `revisionProposal` tRPC router.

### `revisionProposal.listBySession`

Input:

```ts
{ sessionId: string }
```

Returns proposals for the session, scoped through project ownership, ordered by `createdAt asc`.

First version choice: keep proposals in the dedicated `revisionProposal` router and have the frontend call `revisionProposal.listBySession` alongside `session.getById`. This avoids making `session.getById` responsible for two resource shapes while keeping ownership checks explicit.

### Session Message Link

When `session.send` creates a proposal, the assistant message stored in `AISession.messages` should include:

```ts
{
  role: "assistant";
  content: string;
  proposalId?: string;
}
```

The frontend uses `proposalId` to attach the matching `RevisionProposalCard` to the assistant message that produced it. Sessions created before this feature simply have no `proposalId` fields.

### `revisionProposal.accept`

Input:

```ts
{ id: string }
```

Behavior:

1. Load the proposal through project ownership.
2. Require `status === "pending"`.
3. Load the target chapter.
4. Hash the current chapter content and compare it with `baseContentHash`.
5. If the hash differs, mark the proposal `expired` and return a conflict error.
6. Convert current chapter TipTap JSON to plain text.
7. Apply the operation:
   - `append`: append `replacementText` to the end with clean paragraph spacing.
   - `replace`: find `originalText`; require exactly one match; replace it with `replacementText`.
8. Convert the new plain text back to TipTap JSON.
9. Update chapter content and word count.
10. Create a chapter snapshot.
11. Trigger background agents.
12. Mark the proposal `accepted` and set `decidedAt`.

### `revisionProposal.reject`

Input:

```ts
{ id: string }
```

Behavior:

1. Load the proposal through project ownership.
2. Require `status === "pending"`.
3. Mark it `rejected` and set `decidedAt`.
4. Do not change chapter content.

## AI Generation

The first version should detect writing-edit requests inside `session.send`.

Writing-edit requests include obvious commands such as:

- continue / 续写
- rewrite / 改写 / 重写
- polish / 润色
- expand / 扩写
- shorten / 缩写
- add a paragraph / 补一段

Non-edit conversation should continue through the existing normal chat path.

For edit requests, the LLM should be asked to produce a strict structured draft:

```ts
type RevisionProposalDraft =
  | {
      operation: "append";
      instruction: string;
      replacementText: string;
    }
  | {
      operation: "replace";
      instruction: string;
      targetHint: string;
      originalText: string;
      replacementText: string;
    };
```

Validation rules:

- `replacementText` must be non-empty.
- `append` drafts are allowed if text is valid.
- `replace` drafts require:
  - non-empty `originalText`;
  - exactly one occurrence of `originalText` in the current chapter plain text;
  - a minimum original match length to avoid accidental replacement: at least 20 CJK characters when the original contains CJK text, otherwise at least 80 non-whitespace characters.

Intent detection starts as deterministic keyword routing for this version. If the message contains clear edit verbs such as `续写`, `改写`, `重写`, `润色`, `扩写`, `缩写`, `continue`, `rewrite`, `polish`, `expand`, or `shorten`, route to proposal generation. Otherwise use normal chat.

If validation fails, no proposal is created. The assistant should return a normal message explaining that it was not confident enough to produce an applicable replacement, optionally including suggested prose for manual use.

## Content Matching And Storage

Current chapter content is stored as TipTap JSON, but the visible editor currently round-trips through plain text. For this version:

- Matching happens against `tiptapToPlainText(chapter.content)`.
- Accepted changes produce a new plain-text chapter body.
- The new body is converted with `plainTextToTipTap`.
- The whole chapter content is written back as TipTap JSON.
- `baseContentHash` is `sha256(chapter.content)`, using the stored TipTap JSON string rather than plain text. This catches any persisted chapter change, even if the plain text would look similar.

This is intentionally plain-text based. Future TipTap editor work can replace `originalText` matching with document positions or marks without changing the proposal review concept.

## Frontend Design

Add a `RevisionProposalCard` rendered under the assistant message that created it.

Card content:

- Proposal type: `Append proposal` or `Replace proposal`.
- Status: `Pending`, `Accepted`, `Rejected`, or `Expired`.
- For `append`: preview `replacementText`.
- For `replace`: show:
  - "Will replace" original text block.
  - "With" replacement text block.
- Actions:
  - `Accept`
  - `Reject`

Interaction:

- `Accept` calls `revisionProposal.accept`.
- On success, invalidate:
  - `chapter.getById`;
  - `chapter.listByProject`;
  - active session/proposal query.
- `Reject` calls `revisionProposal.reject` and refreshes the proposal state.
- If accept fails because content changed, show a clear conflict state: "Chapter changed after this proposal was generated. Regenerate the proposal."

Display rule:

- Proposals should appear attached to the assistant message that produced them.
- Normal assistant replies do not show proposal UI.

## Safety Rules

- The AI generation path never writes chapter content.
- All manuscript mutations happen only in `revisionProposal.accept`.
- `accept` revalidates ownership, proposal status, content hash, and replacement uniqueness.
- Stale proposals become `expired` instead of applying to changed content.
- Rejected, accepted, and expired proposals cannot be accepted.
- Background agent failures after accept are logged and do not roll back accepted text, matching existing chapter save behavior.

## Error Handling

- Missing model config: reuse the existing model service warning and disabled send behavior.
- Invalid LLM structure: return a normal assistant response; create no proposal.
- Uncertain replacement range: return a normal assistant response; create no proposal.
- Hash mismatch on accept: mark proposal expired and return a conflict error.
- Missing or duplicated `originalText` on accept: mark proposal expired and return a conflict error.
- Unauthorized access: return `NOT_FOUND` or the repository's existing ownership-scoped error style.

## Testing

### Backend Tests

- Accepting an `append` proposal appends text and updates word count.
- Accepting a `replace` proposal replaces a unique matching range.
- `replace` with missing original text does not write and expires the proposal.
- `replace` with duplicated original text does not write and expires the proposal.
- Hash mismatch does not write and expires the proposal.
- Rejected proposals cannot be accepted.
- Accepted proposals cannot be accepted again.
- Non-owner access cannot list, accept, or reject proposals.
- Normal `session.send` messages do not create proposals.
- Writing-edit `session.send` can create a valid proposal.
- Invalid structured LLM output degrades to a normal assistant message.

### Manual Acceptance

- Send "续写这一章"; see an append proposal card.
- Accept it; editor refreshes and includes appended text.
- Reject it; editor content does not change.
- Send "润色最后三段"; if the range is safe, see a replace proposal card.
- Replace proposal shows both original and replacement text.
- Modify the chapter after a proposal is created, then accept; see conflict messaging and no write.
- Refresh the page; pending proposals remain visible.

### Required Verification Commands

Run:

```bash
npm run typecheck
npm run test
npm run build
```

## Implementation Notes

- Prefer a small dedicated service module for applying proposals so router code stays thin.
- Reuse `tiptapToPlainText`, `plainTextToTipTap`, and `countWords`.
- Reuse existing snapshot creation and background agent orchestration.
- Update `docs/api.md` when adding the router and procedures.
- Keep the first frontend card simple: plain blocks, no rich diff.

## Open Decisions For Implementation Planning

These should be resolved during the implementation plan, not by expanding the product scope:

- Exact module placement for the proposal apply service.
- Exact UI copy for pending, accepted, rejected, expired, and conflict states.
- Whether proposal generation logic lives directly in `session.ts` first or behind a small helper module from the start.
