# OpenStory

OpenStory is a Next.js writing workspace for long-form fiction. It combines project/chapter management, Story Bible workspaces for characters, outlines, and world notes, a dark "Writer's Study" editor UI, tRPC APIs, Prisma-backed persistence, and AI writing tools powered through the Vercel AI SDK. Background agents can summarize saved chapters and surface consistency findings directly in the writing flow.

## Stack

- Next.js 15 App Router + React 19
- tRPC v11 with SuperJSON
- SQLite + Prisma ORM via `@prisma/client`
- NextAuth.js v5 beta with Discord OAuth and optional local user mode
- Tailwind CSS v4, lucide-react icons, and Biome
- Vercel AI SDK v6 with Anthropic and OpenAI-compatible provider support

## Setup

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example` and fill the required values:

```env
AUTH_SECRET="generate with npx auth secret"
AUTH_DISCORD_ID="Discord OAuth client ID"
AUTH_DISCORD_SECRET="Discord OAuth client secret"
DATABASE_URL="file:./db.sqlite"
```

AI chat requires either a user LLM config in the database or an environment fallback:

```env
ANTHROPIC_API_KEY="optional local fallback for Anthropic"
OPENAI_API_KEY="optional local fallback for OpenAI-compatible providers"
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o"
```

### Local User Mode

Set `ENABLE_LOCAL_USER_MODE="true"` to use OpenStory as a local-first single-user app. Click `Continue Locally` on the sign-in screen. This mode stores data in local SQLite and does not participate in future cloud sync.

### Model Services

Open the Model Services dialog in the app, add a provider, fetch models, choose a default model, and activate it. API keys are encrypted before saving to SQLite. Set `LLM_ENCRYPTION_KEY` before saving keys. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Initialize the SQLite database:

```bash
npm run db:push
```

Start the development server:

```bash
npm run dev
```

The app is served by Next.js, normally at `http://localhost:3000`.

## Commands

```bash
npm run dev           # Start dev server with Turbopack
npm run build         # Production build
npm run start         # Start production server
npm run preview       # Build + start locally
npm run typecheck     # TypeScript check

npm run db:generate   # Create/apply dev migrations
npm run db:migrate    # Apply production migrations
npm run db:push       # Push schema directly
npm run db:studio     # Open Prisma Studio

npm run check         # Biome check
npm run check:write   # Biome safe fixes
npm run check:unsafe  # Biome unsafe fixes
```

Tests run with Node's built-in test runner:

```bash
npm test                                          # Run all tests
npm test -- src/server/services/encryption.test.ts # Single test file
```

## Current Runtime Notes

`npm run typecheck` and `npm test` pass with the current source. For production builds without Discord OAuth, set `ENABLE_LOCAL_USER_MODE="true"` so Discord credentials are optional.

## Documentation

Start with the [documentation index](docs/index.md) for the project map.

| Document | Use it for |
|----------|------------|
| [API Reference](docs/api.md) | tRPC routers, procedure inputs/outputs, streaming chat, and common error behavior |
| [Current AI System Design](docs/superpowers/specs/2026-05-08-openstory-ai-novel-tool-design.md) | System architecture and AI workspace design |
| [AI Inline Revision Proposals Design](docs/superpowers/specs/2026-05-12-ai-inline-revision-proposals-design.md) | Revision proposal generation, validation, and review flow |
| [AI Session Message Storage](docs/superpowers/specs/2026-05-16-ai-session-message-storage.md) | Append-only chat history storage and legacy message compatibility |
| [Coding Guidelines](Coding%20Guidelines.md) | Repository-level engineering practices |

## Story Bible

Inside a project workspace, the left sidebar switches between chapter editing, characters, outline, and world notes. Character fields can be cleared explicitly, outline parent/chapter references are project-scoped, and world-note text is stored as TipTap JSON. AI chat context includes the current chapter as plain text plus outline, character, and world-note summaries.

The chapter editor supports selection-based AI actions: select text to trigger rewrite, polish, expand, shorten, or continue operations. AI revision proposals render as inline diffs in the editor with accept/reject controls. Chat responses stream in real time.

After chapter saves, background agents refresh the chapter summary and persist open consistency findings. The chat panel shows chapter-level findings with severity, location notes, and actions to ignore, mark resolved, or generate a revision prompt for the bound chapter session.

## Project Layout

```text
src/app/                 # Next.js App Router pages and UI components
src/app/_components/ui/  # Shared UI primitives for buttons, cards, dialogs, forms, and empty states
src/server/api/          # tRPC routers
src/server/ai/           # AI context manager, tools, and background agents
src/server/llm/          # Provider-agnostic LLM client layer
src/server/services/     # Shared text, TipTap, revision proposal, and agent finding services
prisma/schema.prisma     # SQLite schema
docs/index.md            # Documentation map
docs/api.md              # tRPC API reference
```

## Important Conventions

- `~/` maps to `./src/`.
- Chapter and world-note content is stored as TipTap JSON, not plain text.
- `src/server/services/tiptap-converter.ts` is the only module that should understand TipTap JSON internals.
- Reuse shared primitives in `src/app/_components/ui/` for buttons, cards, modals, forms, badges, panel headers, and empty states before adding one-off UI styles.
- Server-only modules use `import "server-only"`, except shared converter code and `story-bible-types.ts` used by client components.
- AI tool data access must always scope entity IDs by `projectId`.
- Existing AI tool updates should filter by `{ id, projectId }`; never reassign ownership by overwriting `projectId`.
- AI chat history is stored as append-only `AISessionMessage` rows. Use `readSessionMessages` and `appendSessionMessages`; do not add new direct JSON writes to `AISession.messages`.
