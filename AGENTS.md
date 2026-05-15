# AGENTS.md

This file provides guidance to coding agents (Claude, GPT, etc.) when working with code in this repository.

## Stack

- **Framework:** Next.js 15 (App Router, React 19)
- **API layer:** tRPC v11 with `superjson` transformer
- **Database:** SQLite via Prisma ORM (`@prisma/client`)
- **Auth:** NextAuth.js v5 (beta) with Discord OAuth and optional local user mode
- **Styling:** Tailwind CSS v4 via `@tailwindcss/postcss`
- **Icons:** `lucide-react`
- **AI:** Vercel AI SDK (`ai` v6 + `@ai-sdk/anthropic` + `@ai-sdk/openai`)
- **Validation:** Zod, with env validation via `@t3-oss/env-nextjs`
- **Lint/format:** Biome (replaces ESLint + Prettier)
- **Package manager:** npm

## Commands

```bash
npm run dev           # Start dev server with Turbopack
npm run build         # Production build
npm run start         # Start production server
npm run preview       # Build + start (for previewing prod locally)
npm run typecheck     # TypeScript type checking (tsc --noEmit)

npm run db:generate   # Create and apply migrations (dev)
npm run db:migrate    # Deploy migrations (prod)
npm run db:push       # Push schema directly without migrations
npm run db:studio     # Open Prisma Studio GUI

npm run test          # Run all tests via Node test runner
npm run test -- src/server/services/encryption.test.ts  # Single test file

npm run check         # Biome check (lint + format)
npm run check:write   # Biome auto-fix
npm run check:unsafe  # Biome auto-fix including unsafe fixes
```

Tests use `scripts/ts-test-loader.mjs` (TypeScript transpilation on the fly) with `--conditions react-server`. Use `node:test` and `node:assert/strict` — no test framework dependency.

## Runtime Requirements

Create `.env` from `.env.example`. Required values:

```env
AUTH_SECRET=""
DATABASE_URL="file:./db.sqlite"
```

Discord OAuth (`AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`) is required unless local user mode is enabled:

```env
ENABLE_LOCAL_USER_MODE="true"
```

AI chat requires either a user LLM config in the database or an environment fallback such as:

```env
ANTHROPIC_API_KEY=""
```

## Architecture

### Path alias

`~/` maps to `./src/` (defined in `tsconfig.json`).

### Design docs

Specs live in `docs/superpowers/specs/`. The current system design is `2026-05-08-openstory-ai-novel-tool-design.md`.

### tRPC data flow

There are **two separate tRPC client trees**. Import from the right one:

| Context | Import from | Usage |
|---------|-------------|-------|
| Server Components (RSC) | `~/trpc/server` | `api.project.list()` directly, `.prefetch()` to hydrate |
| Client Components | `~/trpc/react` | `api.project.list.useSuspenseQuery()` etc. |

### API docs

`docs/api.md` is the full tRPC API reference. Update it when adding routers or procedures.

### tRPC server structure

```text
src/server/api/
  trpc.ts        # tRPC init, createContext, publicProcedure, protectedProcedure
  root.ts        # appRouter registers all sub-routers
  routers/       # project.ts, chapter.ts, character.ts, outline.ts, world-note.ts, search.ts, session.ts, revision-proposal.ts, agent-finding.ts, llm-config.ts
```

- `publicProcedure`: no auth required
- `protectedProcedure`: throws UNAUTHORIZED if `ctx.session.user` is null
- `ctx` provides `db` (PrismaClient singleton) and `session` (NextAuth)
- Currently 10 routers: `project` (5), `chapter` (8), `character` (5), `outline` (5), `worldNote` (4), `search` (1), `session` (5), `revisionProposal` (3), `agentFinding` (3), `llmConfig` (8)
- `llmConfig` router uses a factory pattern (`createLLMConfigRouter`) because it needs injected dependencies
- `llmConfig` procedures: `list`, `create`, `update`, `delete`, `setActive`, `status`, `fetchModels`, `testConnection`

### Auth patterns

Two patterns are used depending on operation type:

**Pattern A - Inline where (update/delete):** Single query with `where: { id, project: { userId } }` for ownership + mutation in one call.

**Pattern B - Pre-flight check (create):** `findFirst` + `TRPCError({ code: "NOT_FOUND" })` before the create, because Prisma `create` has no inline ownership filter.

Session router `create` also uses Pattern B. Never use `findFirstOrThrow`; it throws Prisma-level errors, not tRPC errors.

**Session router** (`src/server/api/routers/session.ts`) is the primary AI chat API. `session.send` integrates LLM client, context manager, and tool registry:

1. Loads session, parses message history
2. If the message has edit intent (续写, 改写, 润色, etc.) and session has a chapter, attempts structured revision proposal via `llmClient.generateObject` with `revisionProposalDraftSchema`
3. If revision proposal succeeds, creates a pending `ChapterRevisionProposal` record and returns a summary with `proposalId`
4. Otherwise falls through to normal chat: calls `assembleContext` for L0+L1 context (or minimal system prompt if no chapterId)
5. Creates `createLLMClient` + `createToolRegistry`
6. Otherwise falls through to normal chat: `llmClient.generate` (non-streaming tRPC path) or streaming Route Handler at `src/app/api/chat/stream/route.ts`
7. Saves full message history (including toolCalls/toolResults) to `AISession.messages` JSON

### Auth

- `src/server/auth/config.ts`: NextAuth config with Discord provider + optional credentials provider + Prisma adapter
- `src/server/auth/index.ts`: exports `auth` (React-cached), `handlers`, `signIn`, `signOut`
- JWT session strategy (required for credentials provider)
- Session augmentation adds `user.id`
- Local User Mode: `ENABLE_LOCAL_USER_MODE="true"` → `CredentialsProvider` with auto-created `local@openstory.local` user

### Database

- SQLite. Prisma client outputs to `generated/prisma/` (non-standard path).
- `src/server/db.ts` exports global singleton `db`.
- After schema changes: `npm run db:push` (or `db:generate` for migrations). Client regenerates via `postinstall`.
- Domain models: Project, Chapter, ChapterSnapshot, Character, WorldNote, Outline, AISession, LLMConfig (encrypted API keys), ChapterRevisionProposal, AgentFinding.
- Chapter content is stored as **TipTap JSON** (ProseMirror document model), not plain text.

### LLM Provider Layer (`src/server/llm/`)

All AI calls go through this layer. UI and tools never call provider SDKs directly.

```
client.ts → model-router.ts → api-key-manager.ts → provider-registry.ts
                                ↗ encrypt/decrypt via encryption.ts
```

- `client.ts`: `createLLMClient({ db, userId })` returns `{ generate, stream, generateObject }`
- `api-key-manager.ts`: resolves keys: active DB config (encrypted, decrypted at runtime) > env var fallback. Throws typed `LLMConfigError` with codes like `ENCRYPTION_KEY_MISSING`, `NO_MODEL_CONFIG`, `API_KEY_DECRYPT_FAILED`.
- `model-router.ts`: routes by task (chat -> Sonnet, summary -> Haiku, etc.)
- `provider-registry.ts`: pluggable provider factories. Built-in: `anthropic`, `openai-compatible`. OpenAI-compatible providers use API key + base URL + model.
- `model-service.ts`: fetches available models from provider APIs for the model service UI
- `rate-limiter.ts`: in-memory token bucket, 10 req/min default

Model service API keys are encrypted with `LLM_ENCRYPTION_KEY` (AES-256-GCM via `src/server/services/encryption.ts`). Keys are never returned by API procedures.

### Shared Services

**TipTap converter** (`src/server/services/tiptap-converter.ts`): the only module that understands TipTap JSON internals. Shared between client and server (no `server-only` import).

- `tiptapToPlainText(json)` / `tiptapToRawText(json)` / `plainTextToTipTap(text)` / `countWords(text)`

**Encryption** (`src/server/services/encryption.ts`): AES-256-GCM encrypt/decrypt for model service API keys. Exports `encryptSecret`, `decryptSecret`, `maskSecret`.

`src/server/services/text-utils.ts`: shared string utilities (`extractSnippet` for search result snippets).

**Chapter splitter** (`src/server/services/chapter-splitter.ts`): splits raw text into chapters using Chinese/English heading patterns, separator lines, or blank-line runs. Exports `splitChapters(text)`, returns `SplitResult[]`.

**Chapter import** (`src/server/services/chapter-import.ts`): converts split results into TipTap JSON chapter data with word counts. Exports `prepareImportData(splits, orderOffset)`.

**Chapter export** (`src/server/services/chapter-export.ts`): converts TipTap chapters to formatted plain text for export. Exports `formatChapterExport(chapters)`.

**Revision proposal** (`src/server/services/revision-proposal.ts`): manages inline revision proposals for AI-assisted editing. Exports `acceptRevisionProposal`, `rejectRevisionProposal`, `hashChapterContent`, `validateRevisionProposalDraft`, `appendToTipTapDoc`, `replaceParagraphsInTipTapDoc`, and `revisionProposalDraftSchema`. Uses SHA256 content hashing for conflict detection and requires exact-substring matching for replace operations.

**AI operation types** (`src/app/_components/story-bible-types.ts`): shared constants and types for AI editing operations (`AI_OPERATIONS`, `AI_OPERATION_LABELS`, `AIOperation`, `hasRevisionEditIntent`). Imported by both client and server code (no `server-only`).

### AI Context Manager (`src/server/ai/context-manager.ts`)

Assembles context for every AI interaction.

- `assembleContext({ db, projectId, currentChapterId })` -> L0 (current chapter + outline + characters) + L1 (neighbor chapter summaries)
- Current chapter lookups must be scoped by both `id` and `projectId`.

### AI Tools Layer (`src/server/ai/tools/`)

8 AI-callable tools for the writing assistant. All tools use dependency injection via `ToolContext` (defined in `data-access.ts`, imported by all tools).

| Tool | File | Description |
|------|------|-------------|
| `read_chapters` | `read-chapters.ts` | Read chapter content by ID |
| `read_characters` | `read-characters.ts` | Read character profiles |
| `write_section` | `write-section.ts` | Insert/append/replace chapter content (plain text -> TipTap JSON) |
| `update_outline` | `update-outline.ts` | Create or update outline nodes |
| `search_mentions` | `search-mentions.ts` | Full-text search across chapter content |
| `check_consistency` | `check-consistency.ts` | LLM-powered consistency check (core logic in `checkConsistency()`, also used by agent) |
| `generate_summary` | `generate-summary.ts` | LLM-powered chapter summarization (core logic in `generateSummary()`, also used by agent) |
| `web_search` | `web-search.ts` | Disabled; returns error message, description says "do not call" |

- `data-access.ts`: anti-corruption layer. All DB access goes through exported functions. All functions that take entity IDs also require `projectId` for defense-in-depth ownership scoping. Tools never import PrismaClient directly.
- Existing entity updates must filter by both entity `id` and `projectId`; do not rewrite ownership by overwriting `projectId` in update data.
- Chapter search must convert TipTap JSON to plain text with `tiptapToPlainText` before matching and extracting snippets.
- `registry.ts`: `createToolRegistry({ db, projectId, llmClient })` assembles all 8 tools into an AI SDK `ToolSet`.
- `ToolContext`: base context `{ db, projectId }`. `ToolContextWithLLM` extends it with `llmClient` for LLM-dependent tools.

### Background Agents (`src/server/ai/agents/`)

Fire-and-forget agents triggered after chapter save. Agent files are thin re-exports from the tool layer (no duplicated logic).

| Agent | File | Re-exports from |
|-------|------|----------------|
| `summary-agent` | `summary-agent.ts` | `generateSummary` as `generateChapterSummary` from `../tools/generate-summary` |
| `consistency-agent` | `consistency-agent.ts` | `checkConsistency` as `checkChapterConsistency` + `ConsistencyIssue` type from `../tools/check-consistency` |
| `agent-runner` | `agent-runner.ts` | `runBackgroundAgents({ db, userId, projectId, chapterId, expectedChapterUpdatedAt? })`; orchestrates both, catches errors, and persists consistency findings. Called via `.catch()` from `chapter.save` and revision proposal acceptance |

Consistency results are stored as `AgentFinding` rows through `src/server/services/agent-finding.ts`. Persistence replaces only open background consistency findings for the chapter, preserves ignored/resolved findings, and skips stale writes when the chapter `updatedAt` no longer matches the run that produced the result.

### Env validation

`src/env.js` validates at build time via `@t3-oss/env-nextjs`. When `ENABLE_LOCAL_USER_MODE="true"`, Discord OAuth vars become optional. Add new vars to both the schema and `.env.example`.

Required vars: `AUTH_SECRET`, `DATABASE_URL`.

Conditionally required (unless local mode): `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`.

Optional vars: `ENABLE_LOCAL_USER_MODE`, `LLM_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.

### UI: "Writer's Study" theme

Dark, warm, literary aesthetic. CSS custom properties are defined in `src/styles/globals.css`.

Design tokens: `study-*` backgrounds, `ink`/`ink-muted`/`ink-dim` text, `amber` accent, `paper` editor surface, `rust` danger, `sage` success. Fonts: Playfair Display (`font-display`), Lora (`font-sans`), Geist Mono (`font-mono`).

Page structure: `/` (landing/dashboard), `/[projectId]` (three-column workspace: 280px sidebar | editor | 380px chat).

Components in `src/app/_components/`:

- `workspace-shell.tsx`: three-column layout, holds chapter + session state, model service dialog
- `project-sidebar.tsx`: chapter list + AI session list
- `chapter-editor-area.tsx`: TipTap rich-text editor with auto-save (2s debounce), inline diff decorations, selection-trigger for AI actions
- `chat-panel.tsx`: AI chat with 3 states, streaming responses, revision proposal cards (accept/reject with per-proposal mutation tracking), chapter finding banner actions, model config status warning
- `project-dashboard.tsx`: home page project grid with empty state, model services entry
- `model-service-dialog.tsx`: model provider configuration (add/edit/activate/test)
- `create-project-dialog.tsx`: modal for creating new projects
- `import-chapters-dialog.tsx`: modal for importing chapters from plain text (splits by heading patterns)
- `workspace-error-boundary.tsx`: React error boundary wrapping workspace and dashboard
- `inline-diff-toolbar.tsx`: toolbar for accepting/rejecting inline diff proposals in the editor
- `selection-menu.tsx`: floating menu for AI actions (rewrite, polish, expand, shorten, continue) on selected text
- `story-bible-types.ts`: shared types and constants for AI operations, workspace modes (imported by both client and server)

Shared UI primitives live in `src/app/_components/ui/`:

- `button.tsx`, `card.tsx`, `badge.tsx`: common action and display primitives
- `modal.tsx`: shared dialog shell with focus trapping, Escape/overlay close handling, and focus restore
- `form.tsx`: shared field, label, input, textarea, and select styling
- `empty-state.tsx`, `panel-header.tsx`, `decorative.tsx`, `utils.ts`: reusable layout, empty-state, ornament, and class-name helpers

Editor extensions in `src/app/_components/extensions/`:

- `inline-diff.ts`: ProseMirror decoration plugin for rendering revision proposal diffs inline
- `selection-trigger.ts`: ProseMirror plugin that detects text selection and reports context for AI actions
- `text-position-mapper.ts`: paragraph-aware text position mapping for cross-paragraph diff matching

Both pages use `<WorkspaceErrorBoundary>` + `<Suspense>` wrapping.

## Critical Conventions

- `~/` maps to `./src/`.
- Server-only modules use `import "server-only"`, except shared converter code imported by client components.
- tRPC server components import from `~/trpc/server`; client components import from `~/trpc/react`.
- AI tool data access must always scope entity IDs by `projectId`.
- Existing AI tool updates should filter by `{ id, projectId }`; never reassign ownership by overwriting `projectId`.
- Chapter search for AI tools should convert TipTap JSON to plain text before matching or extracting snippets.
- Local User Mode uses a normal NextAuth session and local SQLite user. Enabled via `ENABLE_LOCAL_USER_MODE="true"`.
- Model service API keys are encrypted with `LLM_ENCRYPTION_KEY` before saving to SQLite; keys are never returned by API procedures.
- LLM runtime resolves active DB config before `.env` fallback.
- OpenAI-compatible providers use API key + base URL + model.

### File conventions

- Components under `src/app/_components/` (private, not routes)
- Shared UI primitives under `src/app/_components/ui/`; reuse them before adding one-off button, modal, form, card, or badge styling
- `src/server/` modules use `import "server-only"` to prevent client-side imports
- Exception: `tiptap-converter.ts` omits `server-only` because client components import it
- Exception: `story-bible-types.ts` in `_components/` is imported by both client and server code (no `server-only`)

## Documentation

- `README.md`: setup, runtime notes, project overview
- `docs/api.md`: current tRPC API reference
- `CLAUDE.md`: Claude Code specific guidance (synced with this file)
- `docs/superpowers/specs/2026-05-08-openstory-ai-novel-tool-design.md`: current AI system design
