# OpenStory Open-Source Runnable Demo Design

Date: 2026-05-09
Status: Draft for user review

## 1. Goal

The next milestone is a GitHub-ready open-source runnable demo. It should serve two audiences:

- Developers and contributors who want to clone the repo, understand the architecture, run it locally, and extend it.
- Writers and trial users who want to use the app locally without first configuring Discord OAuth.

The demo should prove the smallest useful writing loop:

1. Continue locally.
2. Create a project.
3. Create a chapter.
4. Edit chapter content.
5. Auto-save and persist content.
6. Open the AI panel.
7. Configure a model service in the app.
8. Send an AI message.

The project should feel like a local-first writing application, not just a code sample that happens to compile.

## 2. Scope

### In Scope

- Local User Mode for persistent local use.
- Application-level model service configuration.
- Encrypted model API key storage in SQLite.
- Anthropic and OpenAI-compatible model service support.
- Model list fetching with manual model entry fallback.
- Clear AI panel states for missing configuration and provider failures.
- Minimum writing flow verification.
- README and API documentation updates.
- Useful `typecheck`, `test`, `check`, and `build` commands for contributors.
- Biome configuration cleanup so generated and local-only files do not make the project look broken.

### Out of Scope

- Public production anonymous accounts.
- Cloud sync or multi-device account linking.
- Multi-user server deployment hardening.
- Automatic provider fallback chains.
- Per-task model routing UI.
- Model marketplace or advanced model capability tags.
- Full inline AI selection toolbar in the editor.
- Seed demo project generation.
- Screenshots, GIFs, badges, CI/CD, issue templates, contribution guide, and deployment docs.

## 3. Local User Mode

Local User Mode replaces the earlier "guest" concept. It is a real local-first usage mode, not a temporary demo account.

### Behavior

- Enable with `ENABLE_LOCAL_USER_MODE=true`.
- Add a local credentials provider, for example `local-user`.
- On first use, create a local user such as `local@openstory.local`.
- On later use, reuse the same local user.
- Use the normal NextAuth session path so `ctx.session.user.id` exists.
- Store projects, chapters, AI sessions, and model service settings in SQLite under that local user.
- Keep the same local product experience as a Discord-authenticated user.
- Mark local users as not eligible for future cloud sync.

### UI

The unauthenticated entry view should show:

- `Continue with Discord`
- `Continue Locally`, when Local User Mode is enabled

If Discord OAuth is not configured but Local User Mode is enabled, the app should still be usable locally.

### Safety Notes

Local User Mode is suitable for local single-user use. In a shared server deployment, all visitors using `Continue Locally` would access the same local user. README must state this clearly.

Local User Mode should not bypass authorization. It should create a normal user and rely on existing user/project ownership filters.

## 4. Model Services

Model service configuration is an in-app first-class feature. It should work more like a provider manager than a hidden `.env` concern.

### Supported Provider Types

- `anthropic`
- `openai-compatible`

`openai-compatible` covers OpenAI, DeepSeek, OpenRouter, local gateways, vLLM, and other services exposing OpenAI-compatible chat/model APIs.

### Configuration Fields

Each model service should support:

- Display name
- Provider type
- API key
- Base URL
- Default model
- Available model list cache
- Active state

Only one model service should be active per user in the first version. Activating one service deactivates other services for that user.

### Prisma Model

Extend the existing `LLMConfig` model toward this shape:

```text
id
userId
name
providerType
apiKeyEncrypted
baseUrl
model
availableModels
modelsUpdatedAt
isActive
createdAt
updatedAt
```

Implementation may reuse existing columns where appropriate, but API key semantics must become encrypted. The code should not treat the stored value as plaintext.

### API Key Encryption

Add `LLM_ENCRYPTION_KEY`.

Rules:

- Encrypt API keys before saving to SQLite.
- Decrypt only inside server-side LLM calls or model service test/fetch operations.
- Never return plaintext API keys through tRPC.
- Return safe metadata such as `hasApiKey` and an optional masked preview.
- If `LLM_ENCRYPTION_KEY` is missing, the UI must block saving API keys and show setup instructions.
- If the encryption key changes and an existing key cannot be decrypted, show a clear "re-save API key" error.

Use Node `crypto` with AES-256-GCM or an equivalent authenticated encryption scheme. README should include a simple command for generating a strong encryption key.

## 5. Model List Fetching

The settings UI should provide a `Fetch models` action.

### OpenAI-Compatible

- Request the provider's models endpoint, normally `${baseUrl}/models`.
- Accept standard OpenAI-style responses: `{ data: [{ id: string, ... }] }`.
- Cache the model IDs in `availableModels`.
- Allow manual model entry if fetching fails.

### Anthropic

- Use a supported model list API if available in the chosen provider implementation.
- If model list fetching is unavailable or unstable, provide a built-in list of common Anthropic model IDs.
- Allow manual model entry.

### Model Field UX

The default model field should be a combo box:

- Select from fetched/cached models when available.
- Allow manual input when no list exists or the fetch failed.

Model fetching failure must not prevent users from saving the service.

## 6. LLM Runtime Selection

LLM calls should resolve configuration in this order:

1. The current user's active database `LLMConfig`.
2. Environment variable fallback, such as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`.
3. A structured missing-configuration error.

Environment fallback values are read directly from process environment at runtime. They are not copied into the database and are not part of the encrypted-at-rest requirement.

Business code should not call provider SDKs directly. It should continue using the LLM provider layer.

The provider registry should support:

- Anthropic native provider.
- OpenAI-compatible provider.

Provider-specific errors should be mapped into errors the AI panel can act on.

## 7. Model Service API

Add an `llmConfig` tRPC router.

Procedures:

- `llmConfig.list`
- `llmConfig.create`
- `llmConfig.update`
- `llmConfig.delete`
- `llmConfig.setActive`
- `llmConfig.fetchModels`
- `llmConfig.testConnection`

Returned config shape must omit plaintext API keys:

```typescript
{
  id: string;
  name: string;
  providerType: "anthropic" | "openai-compatible";
  baseUrl: string | null;
  model: string | null;
  availableModels: string[];
  modelsUpdatedAt: Date | null;
  isActive: boolean;
  hasApiKey: boolean;
  apiKeyPreview?: string;
}
```

All procedures must scope data by `ctx.session.user.id`.

## 8. AI Panel States

The AI panel should provide clear states:

- `Ready`: an active model service or env fallback exists.
- `No model configured`: no active DB config and no env fallback.
- `Encryption key missing`: the user is trying to save a key but `LLM_ENCRYPTION_KEY` is not configured.
- `Provider error`: key invalid, base URL unreachable, provider rejected the request, or model missing.
- `Tool activity`: existing expandable tool call display can remain.

`No model configured` should include a `Configure model service` action.

At least two UI entry points should lead to model service settings:

- AI panel configuration prompt.
- Workspace or app-level settings entry.

## 9. Minimum Writing Flow

The first-run flow should not depend on seed data.

Expected behavior:

- A local user with no projects sees a useful empty state and can create a project.
- A project workspace lets the user create or select a chapter.
- Chapter edits are saved and survive refresh.
- The AI panel is available in the workspace.
- If no model service is configured, the AI panel explains how to configure one.
- Once a model service is configured and active, the AI panel can send a message.

The first version should not add inline editor AI commands or selection toolbars. AI interaction happens through the right-side AI panel.

## 10. Error Handling

LLM and model service code should map common failures to structured codes:

- `NO_MODEL_CONFIG`
- `ENCRYPTION_KEY_MISSING`
- `API_KEY_DECRYPT_FAILED`
- `PROVIDER_CONNECTION_FAILED`
- `MODEL_NOT_FOUND`
- `PROVIDER_UNREGISTERED`

The UI should use these codes to show concrete next actions:

- Configure a model service.
- Add `LLM_ENCRYPTION_KEY`.
- Re-save the API key.
- Check Base URL.
- Pick or enter a valid model.

Do not show API keys in logs, errors, or client responses.

## 11. Documentation

README should cover:

- What OpenStory is.
- Local-first usage.
- Local User Mode setup.
- Discord OAuth as optional authentication.
- Model service setup.
- `LLM_ENCRYPTION_KEY`.
- Common errors.
- Contributor commands.

`docs/api.md` should document the new `llmConfig` router.

`AGENTS.md` and `CLAUDE.md` should mention:

- Local User Mode.
- Model service settings.
- API key encryption.
- OpenAI-compatible provider support.
- Model fetching behavior.

## 12. Quality Gates

The finished milestone should pass:

```bash
npm run typecheck
npm run test
npm run check
npm run build
```

Add a standard test script:

```json
"test": "node --test --loader ./scripts/ts-test-loader.mjs --conditions react-server \"src/**/*.test.ts\""
```

Biome should ignore generated and local-only files that should not be part of source quality checks:

- `generated/prisma/`
- `.claude/`
- `.next/`
- `node_modules/`

The check should remain meaningful for `src/`, `scripts/`, docs, and root configuration files.

## 13. Testing Strategy

Add focused tests for:

- Local User Mode creates or reuses a normal user.
- LLM API keys are encrypted before save and decrypted for use.
- tRPC config responses never include plaintext API keys.
- Only one model service can be active per user.
- Model fetch failure still allows manual model entry.
- AI context/tool project scoping remains enforced.
- Missing model configuration returns a structured error.

Existing AI scoping tests should remain part of the standard test command.

## 14. Acceptance Criteria

- A new developer can clone the project, set `.env`, initialize SQLite, and run the app.
- A writer can continue locally without Discord OAuth.
- Local user data persists in SQLite.
- A writer can create a project and chapter, edit content, and see it persist after refresh.
- A writer can configure and activate a model service in the app.
- API keys are encrypted at rest.
- The AI panel gives clear guidance when no model service is configured.
- The AI panel can send a message when a valid model service is configured.
- Typecheck, test, check, and build pass under documented setup.
