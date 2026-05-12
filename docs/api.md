# OpenStory API

Base path: `/api/trpc`
Protocol: tRPC v11 over HTTP GET/POST
Serialization: SuperJSON
Auth: NextAuth.js v5 with Discord OAuth and optional local user mode

All routers currently use `protectedProcedure`. Requests require a valid session, and ownership is enforced through `ctx.session.user.id`.

## Shared Patterns

- Read/update/delete operations scope records to the current user through project ownership.
- Create operations first verify that the target project belongs to the current user.
- Missing or unauthorized resources generally return `NOT_FOUND`; missing sessions return `UNAUTHORIZED`.
- Chapter and world-note content is TipTap JSON. Convert it with `tiptapToPlainText` before counting words, searching, or generating snippets.

## Routers

| Router | Procedures |
|--------|------------|
| `project` | `create`, `list`, `getById`, `update`, `delete` |
| `chapter` | `listByProject`, `getById`, `create`, `save`, `updateOrder`, `importChapters`, `exportChapters`, `delete` |
| `character` | `listByProject`, `getById`, `create`, `update`, `delete` |
| `outline` | `listByProject`, `create`, `update`, `updateOrder`, `delete` |
| `worldNote` | `listByProject`, `create`, `update`, `delete` |
| `search` | `searchAll` |
| `session` | `create`, `list`, `getById`, `send`, `delete` |
| `revisionProposal` | `listBySession`, `accept`, `reject` |
| `llmConfig` | `list`, `create`, `update`, `delete`, `setActive`, `status`, `fetchModels`, `testConnection` |

## Project

### `project.create`

Mutation.

Input:

```typescript
{ name: string; description?: string; genre?: string }
```

Creates a project owned by the current user. `name` is stored as `Project.title`.

### `project.list`

Query.

Input: none.

Returns all projects for the current user, ordered by `updatedAt desc`.

### `project.getById`

Query.

Input:

```typescript
{ id: string }
```

Returns the project if it belongs to the current user, otherwise `null`.

### `project.update`

Mutation.

Input:

```typescript
{
  id: string;
  title?: string;
  description?: string;
  genre?: string;
}
```

Updates a project owned by the current user.

### `project.delete`

Mutation.

Input:

```typescript
{ id: string }
```

Deletes a project owned by the current user. Related domain records are deleted through Prisma relations where configured.

## Chapter

### `chapter.listByProject`

Query.

Input:

```typescript
{ projectId: string }
```

Returns chapter summaries for the project, ordered by `order asc`. The response intentionally omits full chapter content.

Selected fields:

```typescript
{
  id: string;
  title: string;
  order: number;
  wordCount: number;
  summary: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### `chapter.getById`

Query.

Input:

```typescript
{ id: string }
```

Returns the chapter if it belongs to the current user, including the latest 5 snapshots ordered by `version desc`.

### `chapter.create`

Mutation.

Input:

```typescript
{
  projectId: string;
  title: string;
  content?: string;
  order: number;
}
```

Creates a chapter in a project owned by the current user. `content` is TipTap JSON. `wordCount` is computed from plain text converted from TipTap JSON.

### `chapter.save`

Mutation.

Input:

```typescript
{
  id: string;
  content: string;
  title?: string;
  status?: string;
}
```

Updates chapter content and metadata, recalculates word count, creates a snapshot, and triggers background summary/consistency agents. Agent failures are logged and do not fail the save.

Returns the saved chapter with the latest snapshot.

### `chapter.updateOrder`

Mutation.

Input:

```typescript
{ chapters: Array<{ id: string; order: number }> }
```

Updates chapter order for chapters owned by the current user.

Output:

```typescript
{ success: true }
```

### `chapter.importChapters`

Mutation.

Input:

```typescript
{ projectId: string; text: string }
```

Imports chapters from raw text. The text is split using Chinese/English chapter heading patterns (e.g., "第一章...", "Chapter 1..."), separator lines (3+ `=`, `*`, or `-`), or blank-line runs. Each split is converted to TipTap JSON and created as a chapter with computed word count. Order is assigned sequentially after existing chapters.

Returns the created chapters. Throws `BAD_REQUEST` if no chapters are detected. Throws `NOT_FOUND` if the project does not belong to the current user.

### `chapter.exportChapters`

Query.

Input:

```typescript
{ projectId: string }
```

Exports all chapters in a project as formatted plain text. Chapter content is converted from TipTap JSON. Chapters are separated by blank lines with titles as headers.

Returns a plain text string. Throws `NOT_FOUND` if the project has no chapters or does not belong to the current user.

### `chapter.delete`

Mutation.

Input:

```typescript
{ id: string }
```

Deletes a chapter owned by the current user.

## Character

### `character.listByProject`

Query.

Input:

```typescript
{ projectId: string }
```

Returns characters for the project, ordered by `createdAt asc`.

### `character.getById`

Query.

Input:

```typescript
{ id: string }
```

Returns the character if it belongs to the current user, otherwise `null`.

### `character.create`

Mutation.

Input:

```typescript
{
  projectId: string;
  name: string;
  description?: string;
  traits?: string;
  relationships?: string;
  notes?: string;
}
```

Creates a character in a project owned by the current user. `traits` and `relationships` are currently JSON strings.

### `character.update`

Mutation.

Input:

```typescript
{
  id: string;
  name?: string;
  description?: string | null;
  traits?: string | null;
  relationships?: string | null;
  notes?: string | null;
}
```

Updates a character owned by the current user. Passing `null` explicitly clears optional fields.

### `character.delete`

Mutation.

Input:

```typescript
{ id: string }
```

Deletes a character owned by the current user.

## Outline

### `outline.listByProject`

Query.

Input:

```typescript
{ projectId: string }
```

Returns outline nodes for a project owned by the current user, ordered by `order asc` then `title asc`.

### `outline.create`

Mutation.

Input:

```typescript
{
  projectId: string;
  title: string;
  description?: string | null;
  order: number;
  parentId?: string | null;
  chapterId?: string | null;
  status?: "planned" | "writing" | "done";
}
```

Creates an outline node in a project owned by the current user. `parentId` and `chapterId` must belong to the same project.

### `outline.update`

Mutation.

Input:

```typescript
{
  id: string;
  title?: string;
  description?: string | null;
  order?: number;
  parentId?: string | null;
  chapterId?: string | null;
  status?: "planned" | "writing" | "done";
}
```

Updates an outline node owned by the current user. Writes are scoped by `projectId`, parent changes reject self-parenting and cycles, and `chapterId` must belong to the same project.

### `outline.updateOrder`

Mutation.

Input:

```typescript
{
  projectId: string;
  outlines: Array<{
    id: string;
    order: number;
    parentId?: string | null;
  }>;
}
```

Reorders outline nodes in a project owned by the current user and optionally updates parent links after validating project membership and cycles.

### `outline.delete`

Mutation.

Input:

```typescript
{ id: string }
```

Deletes an outline node owned by the current user.

## World Note

### `worldNote.listByProject`

Query.

Input:

```typescript
{ projectId: string }
```

Returns world notes for a project owned by the current user, ordered by `order asc` then `title asc`.

### `worldNote.create`

Mutation.

Input:

```typescript
{
  projectId: string;
  title: string;
  content?: string;
  category?: "general" | "location" | "history" | "magic" | "culture" | "other";
  tags?: string[];
  order?: number;
}
```

Creates a world note in a project owned by the current user. Plain text `content` is stored as TipTap JSON. Tags are trimmed, deduplicated, and stored as a JSON array string.

### `worldNote.update`

Mutation.

Input:

```typescript
{
  id: string;
  title?: string;
  content?: string;
  category?: "general" | "location" | "history" | "magic" | "culture" | "other";
  tags?: string[] | null;
  order?: number;
}
```

Updates a world note owned by the current user using a project-scoped mutation path. Plain text `content` is stored as TipTap JSON; `tags: null` clears tags.

### `worldNote.delete`

Mutation.

Input:

```typescript
{ id: string }
```

Deletes a world note owned by the current user.

## Search

### `search.searchAll`

Query.

Input:

```typescript
{ projectId: string; query: string }
```

Searches chapters, characters, and world notes in a project owned by the current user. Chapter and world-note content is converted from TipTap JSON to plain text before matching and snippet extraction.

Output:

```typescript
type SearchResult =
  | {
      type: "chapter";
      id: string;
      title: string;
      order: number;
      snippet: string;
    }
  | {
      type: "character";
      id: string;
      name: string;
      description: string | null;
    }
  | {
      type: "worldNote";
      id: string;
      title: string;
      category: string;
      snippet: string;
    };
```

## Session

### `session.create`

Mutation.

Input:

```typescript
{
  projectId: string;
  chapterId?: string;
  title?: string;
}
```

Creates an AI session for a project owned by the current user. Messages are initialized as an empty JSON array.

### `session.list`

Query.

Input:

```typescript
{ projectId: string }
```

Returns session metadata for the project, ordered by `updatedAt desc`. Full message history is omitted.

Selected fields:

```typescript
{
  id: string;
  title: string | null;
  chapterId: string | null;
  updatedAt: Date;
  createdAt: Date;
}
```

### `session.getById`

Query.

Input:

```typescript
{ id: string }
```

Returns the session if it belongs to the current user. `messages` is parsed from stored JSON into an array.

### `session.send`

Mutation.

Input:

```typescript
{ id: string; message: string }
```

Sends a user message to the AI assistant.

Internal flow:

1. Load the session scoped to the current user.
2. Parse and append the user message.
3. If the session has a `chapterId`, call `assembleContext({ db, projectId, currentChapterId })`.
4. Create the LLM client and AI tool registry.
5. Call `llmClient.generate({ task: "chat", tools, maxTokens: 4096, temperature: 0.7 })`.
6. Store assistant text plus any tool calls/results in `AISession.messages`.
7. Use the first user message as the session title if no title exists.

Output:

```typescript
{
  message: { role: "assistant"; content: string; proposalId?: string };
  session: {
    id: string;
    title: string | null;
    updatedAt: Date;
  };
}
```

When the user message triggers edit intent and a valid proposal is generated, the response includes `proposalId`. Otherwise `proposalId` is omitted and the normal chat response is returned.

### `session.delete`

Mutation.

Input:

```typescript
{ id: string }
```

Deletes an AI session owned by the current user.

## Revision Proposal

### `revisionProposal.listBySession`

Query.

Input:

```typescript
{ sessionId: string }
```

Returns revision proposals for the session, scoped through session.project.userId ownership. Ordered by `createdAt desc`.

Select: id, status, operation, instruction, targetHint, originalText, replacementText, createdAt, decidedAt.

### `revisionProposal.accept`

Mutation.

Input:

```typescript
{ id: string }
```

Accepts a pending revision proposal. Delegates to the service layer which:
- Verifies ownership via `project.userId`
- Checks proposal is still `pending`
- Verifies `baseContentHash` matches current chapter content (detects concurrent edits)
- For `append`: appends replacementText to chapter plain text
- For `replace`: finds and replaces exactly one match of originalText
- Updates chapter content (converted back to TipTap JSON) and word count
- Creates a chapter snapshot
- Marks proposal as `accepted`
- Triggers background summary/consistency agents (non-blocking)

Returns `{ proposalId: string, status: string }`.

Error codes:
- `NOT_FOUND` -- proposal not found or not owned by user
- `BAD_REQUEST` -- proposal is not in pending status
- `CONFLICT` -- chapter changed since proposal was created, or replace target no longer unique; proposal is expired

### `revisionProposal.reject`

Mutation.

Input:

```typescript
{ id: string }
```

Rejects a pending revision proposal. Verifies ownership and pending status.
Returns `{ proposalId: string, status: string }`.

## LLM Config

Model service configuration for per-user LLM provider settings. API keys are encrypted at rest with `LLM_ENCRYPTION_KEY` and are **never** returned by any procedure. All procedures scope records to the current user.

### `llmConfig.list`

Query.

Input: none.

Returns all LLM configurations for the current user, ordered by `updatedAt desc`. Each item includes `id`, `name`, `providerType`, `baseUrl`, `model`, `availableModels` (parsed from JSON), `modelsUpdatedAt`, `isActive`, and `hasApiKey` (boolean, true when an encrypted key exists).

### `llmConfig.create`

Mutation.

Input:

```typescript
{
  name: string;
  providerType: "anthropic" | "openai-compatible";
  apiKey: string;
  baseUrl?: string;
  model?: string;
  isActive?: boolean;
}
```

Creates a new LLM configuration. If `isActive` is `true`, deactivates all other configs for the user in a transaction. Requires `LLM_ENCRYPTION_KEY` to be set. Returns the serialized config (no API key).

### `llmConfig.update`

Mutation.

Input:

```typescript
{
  id: string;
  name?: string;
  providerType?: "anthropic" | "openai-compatible";
  apiKey?: string;
  baseUrl?: string | null;
  model?: string | null;
}
```

Updates an existing LLM configuration owned by the current user. If `apiKey` is provided, re-encrypts it with `LLM_ENCRYPTION_KEY`. Returns the serialized config (no API key). Throws `NOT_FOUND` if the config does not belong to the current user.

### `llmConfig.delete`

Mutation.

Input:

```typescript
{ id: string }
```

Deletes an LLM configuration owned by the current user. Throws `NOT_FOUND` if the config does not belong to the current user.

Output:

```typescript
{ success: true }
```

### `llmConfig.setActive`

Mutation.

Input:

```typescript
{ id: string }
```

Sets the specified config as the active configuration for the current user. Deactivates all other configs in a transaction. Throws `NOT_FOUND` if the config does not belong to the current user. Returns the serialized config.

### `llmConfig.status`

Query.

Input: none.

Returns the current LLM configuration status for the user:

```typescript
{ hasUsableConfig: boolean; source: "db" | "env" | "none" }
```

`source` is `"db"` when the user has an active DB config, `"env"` when falling back to `ANTHROPIC_API_KEY`, or `"none"` when no configuration is available.

### `llmConfig.fetchModels`

Mutation.

Input:

```typescript
{ id: string }
```

Fetches available models from the provider API using the stored (decrypted) API key. Updates the config's `availableModels` and `modelsUpdatedAt` fields. Requires `LLM_ENCRYPTION_KEY`. Returns the serialized config with the updated model list. Throws `NOT_FOUND` if the config does not belong to the current user.

### `llmConfig.testConnection`

Mutation.

Input:

```typescript
{ id: string; model?: string }
```

Tests connectivity to the provider by sending a minimal prompt. Uses the stored (decrypted) API key and the specified model, falling back to the config's model, then to `claude-sonnet-4-20250514`. Requires `LLM_ENCRYPTION_KEY`. Returns `{ success: true }` on success. Throws `BAD_REQUEST` with the provider error message on failure.

## AI Tool Data Access

AI-callable tools use `src/server/ai/tools/data-access.ts` as their anti-corruption layer. Tools should not import Prisma directly.

Important constraints:

- Functions taking entity IDs must also take `projectId`.
- Current chapter context lookup must use both `id` and `projectId`.
- Existing outline updates must filter by both `id` and `projectId`; do not overwrite ownership with a new `projectId`.
- Chapter search for AI tools must convert TipTap JSON to plain text before matching and snippet extraction.

## Error Shape

tRPC errors are returned in the standard tRPC response envelope. Common codes:

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | No valid session |
| `BAD_REQUEST` | Input validation failed |
| `NOT_FOUND` | Resource does not exist or is outside the current user's scope |
| `INTERNAL_SERVER_ERROR` | Server-side failure, including AI generation failure |
