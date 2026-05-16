# AI Session Turn Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the AI session turn Module so non-streaming chat, streaming chat, and structured revision proposal generation share one server-side implementation.

**Architecture:** Create `src/server/ai/session-turn.ts` as the primary Module for an `AISession` user turn. Keep non-streaming and streaming external interfaces while sharing stored message parsing, context/tool setup, message persistence, revision proposal policy, and title updates behind the same module boundary. The original plan kept `AISession.messages` as JSON; the follow-up migration now stores new turns in append-only `AISessionMessage` rows while preserving legacy JSON reads.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma SQLite, Vercel AI SDK, Zod, Node test runner, TypeScript.

**Follow-up Completed:** New chat turns are stored in `AISessionMessage` rows instead of rewriting the whole `AISession.messages` JSON string. `AISession.messages` remains only as a legacy compatibility source for sessions created before the migration. See [AI Session Message Storage](../specs/2026-05-16-ai-session-message-storage.md).

---

## File Structure

- Create `src/server/ai/session-turn.ts`: owns AI session turn types, message parsing, server-side routing policy, non-streaming send, streaming start, atomic turn persistence, revision proposal attempt, and test dependency injection.
- Create `src/server/ai/session-turn.test.ts`: unit tests for the new Module using fake DB delegates and fake LLM/context/tool dependencies.
- Modify `src/server/api/routers/session.ts`: keep `create`, `list`, `getById`, and `delete`; replace the large `send` implementation with a call to `sendAISessionTurn`.
- Modify `src/server/ai/streaming-session.ts`: re-export compatibility names or delegate to `startStreamingAISessionTurn`; keep `StreamingSessionError` available for existing imports.
- Modify `src/server/ai/streaming-session.test.ts`: update tests to use the new `message` input instead of full `incomingMessages`.
- Modify `src/server/ai/streaming-request.ts`: narrow streaming request body from full `messages` to the current `message`.
- Modify `src/server/ai/streaming-request.test.ts`: update parser tests for `{ message, sessionId, projectId }`.
- Modify `src/app/api/chat/stream/route.ts`: pass `message` to `startStreamingAISessionTurn`.
- Modify `src/app/_components/chat-panel.tsx`: send only the current trimmed message to `/api/chat/stream`; keep revision-intent messages on the non-streaming mutation path.

---

### Task 1: Add Session Turn Core Tests

**Files:**
- Create: `src/server/ai/session-turn.test.ts`
- Create later: `src/server/ai/session-turn.ts`

- [ ] **Step 1: Write failing tests for shared parsing, persistence, non-streaming chat, and streaming guard**

Create `src/server/ai/session-turn.test.ts` with this content:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import type { ModelMessage } from "ai";
import {
	AISessionTurnError,
	parseStoredSessionMessages,
	sendAISessionTurn,
	startStreamingAISessionTurn,
} from "./session-turn";

function createDb(overrides: Partial<Record<string, unknown>> = {}) {
	const storedMessages = [{ role: "assistant", content: "previous reply" }];
	let updateArgs: unknown = null;
	let transactionUsed = false;

	const db = {
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
			transactionUsed = true;
			return callback(db);
		},
		aISession: {
			findFirst: async () => ({
				id: "session-1",
				projectId: "project-1",
				chapterId: "chapter-1",
				title: null,
				messages: JSON.stringify(storedMessages),
			}),
			update: async (args: unknown) => {
				updateArgs = args;
				return {
					id: "session-1",
					title: "continue the scene",
					updatedAt: new Date("2026-05-15T00:00:00.000Z"),
				};
			},
		},
		chapter: {
			findFirst: async () => null,
		},
		chapterRevisionProposal: {
			create: async () => {
				throw new Error("proposal creation should not run in this test");
			},
		},
		...overrides,
	};

	return {
		db,
		getUpdateArgs: () => updateArgs,
		getTransactionUsed: () => transactionUsed,
		storedMessages,
	};
}

test("parseStoredSessionMessages filters malformed stored values", () => {
	assert.deepEqual(parseStoredSessionMessages("{"), []);
	assert.deepEqual(parseStoredSessionMessages(JSON.stringify({ role: "user" })), []);
	assert.deepEqual(
		parseStoredSessionMessages(
			JSON.stringify([
				{ role: "assistant", content: "ok", extra: true },
				{ role: "assistant" },
				null,
			]),
		),
		[{ role: "assistant", content: "ok", extra: true }],
	);
});

test("sendAISessionTurn generates chat from server-side history and persists one turn", async () => {
	const { db, getUpdateArgs, getTransactionUsed, storedMessages } = createDb();
	const contextMessages: ModelMessage[] = [{ role: "system", content: "chapter context" }];
	const tools = { read_chapters: { description: "tool" } };
	let generateArgs: unknown = null;

	const result = await sendAISessionTurn({
		db: db as never,
		userId: "user-1",
		sessionId: "session-1",
		message: "continue the scene",
		dependencies: {
			assembleContext: async () => contextMessages,
			createLLMClient: () => ({
				generate: async (args: unknown) => {
					generateArgs = args;
					return {
						text: "assistant response",
						toolCalls: [{ name: "read_chapters", args: { ids: ["chapter-1"] } }],
						toolResults: [{ name: "read_chapters", result: "chapter text" }],
					};
				},
				generateObject: async () => {
					throw new Error("not used");
				},
			}),
			createToolRegistry: () => tools as never,
		},
	});

	assert.deepEqual(generateArgs, {
		task: "chat",
		messages: [
			...contextMessages,
			...storedMessages,
			{ role: "user", content: "continue the scene" },
		],
		tools,
		maxTokens: 4096,
		temperature: 0.7,
	});
	assert.deepEqual(result.message, {
		role: "assistant",
		content: "assistant response",
	});
	assert.equal(getTransactionUsed(), true);
	assert.deepEqual(getUpdateArgs(), {
		where: { id: "session-1" },
		data: {
			messages: JSON.stringify([
				...storedMessages,
				{ role: "user", content: "continue the scene" },
				{
					role: "assistant",
					content: "assistant response",
					toolCalls: [{ name: "read_chapters", args: { ids: ["chapter-1"] } }],
					toolResults: [{ name: "read_chapters", result: "chapter text" }],
				},
			]),
			title: "continue the scene",
		},
	});
});

test("startStreamingAISessionTurn rejects revision-like input before streaming", async () => {
	const { db } = createDb();
	let streamed = false;

	await assert.rejects(
		startStreamingAISessionTurn({
			db: db as never,
			userId: "user-1",
			sessionId: "session-1",
			projectId: "project-1",
			message: "请润色这一段",
			dependencies: {
				assembleContext: async () => [],
				createLLMClient: () => ({
					stream: async () => {
						streamed = true;
						return { textStream: (async function* () {})() };
					},
				}),
				createToolRegistry: () => ({}) as never,
			},
		}),
		(error: unknown) =>
			error instanceof AISessionTurnError &&
			error.status === 409 &&
			error.code === "NON_STREAMING_REQUIRED",
	);

	assert.equal(streamed, false);
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npm run test -- src/server/ai/session-turn.test.ts
```

Expected: FAIL because `src/server/ai/session-turn.ts` does not exist.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/server/ai/session-turn.test.ts
git commit -m "test: specify ai session turn module"
```

---

### Task 2: Implement Session Turn Core Module

**Files:**
- Create: `src/server/ai/session-turn.ts`
- Test: `src/server/ai/session-turn.test.ts`

- [ ] **Step 1: Create the initial Module implementation**

Create `src/server/ai/session-turn.ts`:

```ts
import "server-only";

import type { PrismaClient } from "@prisma/client";
import type { ModelMessage, ToolSet } from "ai";
import {
	AI_OPERATION_LABELS,
	hasRevisionEditIntent,
} from "~/app/_components/story-bible-types";
import { createLLMClient as defaultCreateLLMClient } from "~/server/llm/client";
import type { TaskType } from "~/server/llm/types";
import {
	hashChapterContent,
	revisionProposalDraftSchema,
	validateRevisionProposalDraft,
} from "~/server/services/revision-proposal";
import { tiptapToPlainText } from "~/server/services/tiptap-converter";
import { assembleContext as defaultAssembleContext } from "./context-manager";
import { createToolRegistry as defaultCreateToolRegistry } from "./tools/registry";

const MINIMAL_SYSTEM_PROMPT =
	"You are an AI writing assistant for a novel project. " +
	"Your role is to help the author write, edit, and plan their novel. " +
	"You can read chapters, search the text, check consistency, " +
	"update outlines, generate summaries, and write text. " +
	"Always be constructive and specific in your feedback. " +
	"When suggesting text, match the author's style and tone.";

export class AISessionTurnError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly code:
			| "SESSION_NOT_FOUND"
			| "PROJECT_MISMATCH"
			| "MISSING_USER_MESSAGE"
			| "NON_STREAMING_REQUIRED"
			| "AI_GENERATION_FAILED",
	) {
		super(message);
		this.name = "AISessionTurnError";
	}
}

type LLMClient = ReturnType<typeof defaultCreateLLMClient>;

interface ChatLLMClient {
	generate(params: {
		task: TaskType;
		messages: ModelMessage[];
		tools?: ToolSet;
		maxTokens?: number;
		temperature?: number;
	}): Promise<{ text?: string; toolCalls?: unknown[]; toolResults?: unknown[] }>;
	generateObject(params: {
		task: TaskType;
		messages: ModelMessage[];
		schema: typeof revisionProposalDraftSchema;
		temperature?: number;
	}): Promise<{ object: unknown }>;
}

interface StreamingLLMClient {
	stream(params: {
		task: TaskType;
		messages: ModelMessage[];
		tools?: ToolSet;
		maxTokens?: number;
		temperature?: number;
	}): Promise<{
		textStream: AsyncIterable<string>;
		toolCalls?: PromiseLike<unknown[]>;
		toolResults?: PromiseLike<unknown[]>;
	}>;
}

interface SessionTurnDependencies {
	assembleContext?: typeof defaultAssembleContext;
	createLLMClient?: (opts: { db: PrismaClient; userId: string }) => Partial<LLMClient> & Partial<ChatLLMClient> & Partial<StreamingLLMClient>;
	createToolRegistry?: (opts: {
		db: PrismaClient;
		projectId: string;
		llmClient: Partial<LLMClient> & Partial<ChatLLMClient> & Partial<StreamingLLMClient>;
	}) => ToolSet;
}

export interface StoredSessionMessage {
	role: string;
	content: string;
	[key: string]: unknown;
}

export function parseStoredSessionMessages(raw: string): StoredSessionMessage[] {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(message): message is StoredSessionMessage =>
				typeof message === "object" &&
				message !== null &&
				"role" in message &&
				"content" in message &&
				typeof message.role === "string" &&
				typeof message.content === "string",
		);
	} catch {
		return [];
	}
}

function buildUserMessage(message: string): StoredSessionMessage {
	if (!message.trim()) {
		throw new AISessionTurnError("Missing user message", 400, "MISSING_USER_MESSAGE");
	}
	return { role: "user", content: message };
}

async function appendSessionTurn(opts: {
	db: PrismaClient;
	userId: string;
	sessionId: string;
	userMessage: StoredSessionMessage;
	assistantMessage: StoredSessionMessage;
}) {
	return opts.db.$transaction(async (tx) => {
		const current = await tx.aISession.findFirst({
			where: { id: opts.sessionId, project: { userId: opts.userId } },
		});
		if (!current) {
			throw new AISessionTurnError("Session not found", 404, "SESSION_NOT_FOUND");
		}

		const currentMessages = parseStoredSessionMessages(current.messages);
		currentMessages.push(opts.userMessage);
		currentMessages.push(opts.assistantMessage);

		const data: { messages: string; title?: string } = {
			messages: JSON.stringify(currentMessages),
		};
		if (!current.title) {
			data.title = opts.userMessage.content.slice(0, 100);
		}

		return tx.aISession.update({
			where: { id: opts.sessionId },
			data,
		});
	});
}

function resolveDependencies(dependencies?: SessionTurnDependencies) {
	return {
		assembleContext: dependencies?.assembleContext ?? defaultAssembleContext,
		createLLMClient: dependencies?.createLLMClient ?? defaultCreateLLMClient,
		createToolRegistry:
			dependencies?.createToolRegistry ??
			((args: {
				db: PrismaClient;
				projectId: string;
				llmClient: Partial<LLMClient> & Partial<ChatLLMClient> & Partial<StreamingLLMClient>;
			}) =>
				defaultCreateToolRegistry({
					...args,
					llmClient: args.llmClient as LLMClient,
				})),
	};
}

async function loadSession(db: PrismaClient, sessionId: string, userId: string) {
	const aiSession = await db.aISession.findFirst({
		where: { id: sessionId, project: { userId } },
	});
	if (!aiSession) {
		throw new AISessionTurnError("Session not found", 404, "SESSION_NOT_FOUND");
	}
	return aiSession;
}

async function buildContextMessages(opts: {
	db: PrismaClient;
	projectId: string;
	chapterId: string | null;
	assembleContext: typeof defaultAssembleContext;
}) {
	if (!opts.chapterId) {
		return [{ role: "system" as const, content: MINIMAL_SYSTEM_PROMPT }];
	}
	return opts.assembleContext({
		db: opts.db,
		projectId: opts.projectId,
		currentChapterId: opts.chapterId,
	});
}

async function resolveToolMetadata(
	result: Awaited<ReturnType<StreamingLLMClient["stream"]>>,
) {
	const [toolCalls, toolResults] = await Promise.all([
		result.toolCalls ?? Promise.resolve([]),
		result.toolResults ?? Promise.resolve([]),
	]);

	return {
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		toolResults: toolResults.length > 0 ? toolResults : undefined,
	};
}

async function tryCreateRevisionProposal(opts: {
	db: PrismaClient;
	userId: string;
	session: { id: string; projectId: string; chapterId: string | null; messages: string };
	userMessage: StoredSessionMessage;
	llmClient: Partial<ChatLLMClient>;
}) {
	if (!opts.session.chapterId || !hasRevisionEditIntent(opts.userMessage.content)) {
		return null;
	}
	if (!opts.llmClient.generateObject) {
		return null;
	}

	const chapter = await opts.db.chapter.findFirst({
		where: { id: opts.session.chapterId, projectId: opts.session.projectId },
	});
	if (!chapter) return null;

	const baseContentHash = hashChapterContent(chapter.content);
	const chapterPlainText = tiptapToPlainText(chapter.content);
	const isChinese = /\p{Script=Han}/u.test(opts.userMessage.content);
	const systemPrompt = isChinese
		? `你是一个小说写作修订助手。用户希望对章节进行修改。请根据用户的要求生成一个修订提案。\n\n当前章节内容：\n---\n${chapterPlainText}\n---\n\n规则：\n- 如果用户要求续写、扩写内容，使用 "append" 操作，只需提供 instruction 和 replacementText\n- 如果用户要求改写、润色、重写特定段落，使用 "replace" 操作，需要提供 targetHint（简述修改目标）、originalText（从章节中复制的原文片段，必须完全匹配）、replacementText（替换后的文本）\n- originalText 必须是章节原文的精确子串，不可自行改写或省略\n- 替换目标至少包含 20 个中文字符或 80 个非空白英文字符\n- replacementText 应保持与原文风格一致`
		: `You are a novel revision assistant. The user wants to modify a chapter. Generate a revision proposal based on their request.\n\nCurrent chapter content:\n---\n${chapterPlainText}\n---\n\nRules:\n- For continuation/expansion requests, use "append" operation with instruction and replacementText\n- For rewriting/polishing specific sections, use "replace" operation with targetHint, originalText (exact substring from chapter), and replacementText\n- originalText must be an exact substring from the chapter text\n- Replacement target must contain at least 80 non-whitespace characters for English or 20 CJK characters\n- replacementText should match the author's style`;

	try {
		const storedMessages = parseStoredSessionMessages(opts.session.messages);
		const { object } = await opts.llmClient.generateObject({
			task: "revision",
			messages: [
				{ role: "system", content: systemPrompt },
				...(storedMessages as ModelMessage[]),
				opts.userMessage as ModelMessage,
			],
			schema: revisionProposalDraftSchema,
			temperature: 0.7,
		});
		const draft = revisionProposalDraftSchema.parse(object);
		const chapterNow = await opts.db.chapter.findFirst({
			where: { id: opts.session.chapterId, projectId: opts.session.projectId },
		});
		if (!chapterNow || hashChapterContent(chapterNow.content) !== baseContentHash) {
			console.info("[session-turn] revision proposal skipped", { outcome: "chapter_changed" });
			return null;
		}
		const validation = validateRevisionProposalDraft(draft, tiptapToPlainText(chapterNow.content));
		if (!validation.ok) {
			console.info("[session-turn] revision proposal skipped", { outcome: "validation_failed", message: validation.message });
			return null;
		}
		const proposal = await opts.db.chapterRevisionProposal.create({
			data: {
				projectId: opts.session.projectId,
				chapterId: opts.session.chapterId,
				sessionId: opts.session.id,
				status: "pending",
				operation: draft.operation,
				instruction: draft.instruction,
				targetHint: draft.operation === "replace" ? draft.targetHint : null,
				originalText: draft.operation === "replace" ? draft.originalText : null,
				replacementText: draft.replacementText,
				baseContentHash,
			},
		});
		const content =
			draft.operation === "append"
				? `已为您生成追加提案：${draft.instruction}`
				: `已为您生成替换提案：${draft.targetHint}`;
		return { content, proposalId: proposal.id };
	} catch (error) {
		console.info("[session-turn] revision proposal skipped", { outcome: "llm_failed", error });
		return null;
	}
}

export async function sendAISessionTurn(opts: {
	db: PrismaClient;
	userId: string;
	sessionId: string;
	message: string;
	selectionContext?: {
		selectedText: string;
		beforeContext: string;
		afterContext: string;
		operation: keyof typeof AI_OPERATION_LABELS;
	};
	dependencies?: SessionTurnDependencies;
}) {
	const dependencies = resolveDependencies(opts.dependencies);
	const session = await loadSession(opts.db, opts.sessionId, opts.userId);
	let content = opts.message;
	if (opts.selectionContext) {
		const sel = opts.selectionContext;
		content = `${AI_OPERATION_LABELS[sel.operation]}${sel.operation === "continue" ? "" : "选中的文字"}：${sel.selectedText}`;
	}
	const userMessage = buildUserMessage(content);
	const llmClient = dependencies.createLLMClient({ db: opts.db, userId: opts.userId });

	const proposal = await tryCreateRevisionProposal({
		db: opts.db,
		userId: opts.userId,
		session,
		userMessage,
		llmClient,
	});
	if (proposal) {
		const assistantMessage: StoredSessionMessage = {
			role: "assistant",
			content: proposal.content,
			proposalId: proposal.proposalId,
		};
		const updated = await appendSessionTurn({
			db: opts.db,
			userId: opts.userId,
			sessionId: opts.sessionId,
			userMessage,
			assistantMessage,
		});
		return {
			message: {
				role: "assistant" as const,
				content: proposal.content,
				proposalId: proposal.proposalId,
			},
			session: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt },
		};
	}

	if (!llmClient.generate) {
		throw new AISessionTurnError("AI generation failed", 500, "AI_GENERATION_FAILED");
	}
	const contextMessages = await buildContextMessages({
		db: opts.db,
		projectId: session.projectId,
		chapterId: session.chapterId,
		assembleContext: dependencies.assembleContext,
	});
	const tools = dependencies.createToolRegistry({
		db: opts.db,
		projectId: session.projectId,
		llmClient,
	});
	const result = await llmClient.generate({
		task: "chat",
		messages: [
			...contextMessages,
			...(parseStoredSessionMessages(session.messages) as ModelMessage[]),
			userMessage as ModelMessage,
		],
		tools,
		maxTokens: 4096,
		temperature: 0.7,
	});
	const assistantMessage: StoredSessionMessage = {
		role: "assistant",
		content: result.text ?? "",
		...(result.toolCalls?.length ? { toolCalls: result.toolCalls } : {}),
		...(result.toolResults?.length ? { toolResults: result.toolResults } : {}),
	};
	const updated = await appendSessionTurn({
		db: opts.db,
		userId: opts.userId,
		sessionId: opts.sessionId,
		userMessage,
		assistantMessage,
	});
	return {
		message: { role: "assistant" as const, content: result.text ?? "" },
		session: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt },
	};
}

export async function startStreamingAISessionTurn(opts: {
	db: PrismaClient;
	userId: string;
	sessionId: string;
	projectId: string;
	message: string;
	dependencies?: SessionTurnDependencies;
}) {
	if (hasRevisionEditIntent(opts.message)) {
		throw new AISessionTurnError(
			"This session turn requires non-streaming handling",
			409,
			"NON_STREAMING_REQUIRED",
		);
	}
	const dependencies = resolveDependencies(opts.dependencies);
	const session = await loadSession(opts.db, opts.sessionId, opts.userId);
	if (session.projectId !== opts.projectId) {
		throw new AISessionTurnError("Session project mismatch", 400, "PROJECT_MISMATCH");
	}
	const userMessage = buildUserMessage(opts.message);
	const contextMessages = await buildContextMessages({
		db: opts.db,
		projectId: session.projectId,
		chapterId: session.chapterId,
		assembleContext: dependencies.assembleContext,
	});
	const llmClient = dependencies.createLLMClient({ db: opts.db, userId: opts.userId });
	if (!llmClient.stream) {
		throw new AISessionTurnError("AI generation failed", 500, "AI_GENERATION_FAILED");
	}
	const tools = dependencies.createToolRegistry({
		db: opts.db,
		projectId: session.projectId,
		llmClient,
	});
	const result = await llmClient.stream({
		task: "chat",
		messages: [
			...contextMessages,
			...(parseStoredSessionMessages(session.messages) as ModelMessage[]),
			userMessage as ModelMessage,
		],
		tools,
		maxTokens: 4096,
		temperature: 0.7,
	});
	return {
		textStream: result.textStream,
		persist: async (assistantText: string) => {
			if (!assistantText) return;
			const toolMetadata = await resolveToolMetadata(result);
			await appendSessionTurn({
				db: opts.db,
				userId: opts.userId,
				sessionId: opts.sessionId,
				userMessage,
				assistantMessage: {
					role: "assistant",
					content: assistantText,
					...(toolMetadata.toolCalls ? { toolCalls: toolMetadata.toolCalls } : {}),
					...(toolMetadata.toolResults ? { toolResults: toolMetadata.toolResults } : {}),
				},
			});
		},
	};
}
```

- [ ] **Step 2: Run the focused test and fix compile errors only**

Run:

```bash
npm run test -- src/server/ai/session-turn.test.ts
```

Expected: PASS after resolving any TypeScript type issues caused by fake DB shapes. Do not change behavior beyond making the tests pass.

- [ ] **Step 3: Commit the core Module**

```bash
git add src/server/ai/session-turn.ts src/server/ai/session-turn.test.ts
git commit -m "feat: add ai session turn module"
```

---

### Task 3: Delegate tRPC session.send to the New Module

**Files:**
- Modify: `src/server/api/routers/session.ts`
- Test: `src/server/ai/session-turn.test.ts`

- [ ] **Step 1: Replace imports in `session.ts`**

Remove these imports:

```ts
import type { ModelMessage } from "ai";
import {
	AI_OPERATION_LABELS,
	hasRevisionEditIntent,
} from "~/app/_components/story-bible-types";
import { assembleContext } from "~/server/ai/context-manager";
import { createToolRegistry } from "~/server/ai/tools/registry";
import { createLLMClient } from "~/server/llm/client";
import {
	hashChapterContent,
	revisionProposalDraftSchema,
	validateRevisionProposalDraft,
} from "~/server/services/revision-proposal";
import { tiptapToPlainText } from "~/server/services/tiptap-converter";
```

Add:

```ts
import {
	AISessionTurnError,
	sendAISessionTurn,
} from "~/server/ai/session-turn";
```

- [ ] **Step 2: Replace only the `send` mutation body**

Inside `send: protectedProcedure...mutation`, replace the whole current implementation with:

```ts
try {
	return await sendAISessionTurn({
		db: ctx.db,
		userId: ctx.session.user.id,
		sessionId: input.id,
		message: input.message,
		selectionContext: input.selectionContext,
	});
} catch (error) {
	if (error instanceof AISessionTurnError) {
		if (error.code === "SESSION_NOT_FOUND") {
			throw new TRPCError({ code: "NOT_FOUND" });
		}
		if (error.code === "MISSING_USER_MESSAGE") {
			throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
		}
	}
	console.error("[session.send] AI generation failed:", error);
	throw new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "AI generation failed. Please try again.",
	});
}
```

- [ ] **Step 3: Run tests that cover the moved behavior**

Run:

```bash
npm run test -- src/server/ai/session-turn.test.ts src/server/services/revision-proposal.test.ts src/server/api/routers/revision-proposal.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit the router delegation**

```bash
git add src/server/api/routers/session.ts
git commit -m "refactor: delegate session send turns"
```

---

### Task 4: Move Streaming Session to the New Interface

**Files:**
- Modify: `src/server/ai/streaming-session.ts`
- Modify: `src/server/ai/streaming-session.test.ts`
- Test: `src/server/ai/session-turn.test.ts`

- [ ] **Step 1: Replace `streaming-session.ts` with a compatibility wrapper**

Set `src/server/ai/streaming-session.ts` to:

```ts
import "server-only";

export {
	AISessionTurnError as StreamingSessionError,
	startStreamingAISessionTurn as startStreamingSessionChat,
} from "./session-turn";
```

- [ ] **Step 2: Update streaming tests to pass `message`**

In `src/server/ai/streaming-session.test.ts`, replace:

```ts
incomingMessages: [{ role: "user", content: "continue the scene" }],
```

with:

```ts
message: "continue the scene",
```

Replace the second test's `incomingMessages` the same way:

```ts
message: "hello",
```

- [ ] **Step 3: Run streaming and session-turn tests**

Run:

```bash
npm run test -- src/server/ai/session-turn.test.ts src/server/ai/streaming-session.test.ts
```

Expected: PASS. The existing streaming test should still assert server-side history, context, tools, atomic persistence, and project mismatch rejection.

- [ ] **Step 4: Commit the streaming wrapper**

```bash
git add src/server/ai/streaming-session.ts src/server/ai/streaming-session.test.ts
git commit -m "refactor: route streaming chat through session turns"
```

---

### Task 5: Narrow Streaming Request Shape

**Files:**
- Modify: `src/server/ai/streaming-request.ts`
- Modify: `src/server/ai/streaming-request.test.ts`
- Modify: `src/app/api/chat/stream/route.ts`

- [ ] **Step 1: Change streaming request body type**

In `src/server/ai/streaming-request.ts`, replace the `StreamingChatRequestBody` interface with:

```ts
export interface StreamingChatRequestBody {
	message: string;
	sessionId: string;
	projectId: string;
}
```

Replace `isStreamingChatRequestBody` with:

```ts
function isStreamingChatRequestBody(
	body: unknown,
): body is StreamingChatRequestBody {
	return (
		typeof body === "object" &&
		body !== null &&
		"message" in body &&
		"sessionId" in body &&
		"projectId" in body &&
		typeof body.message === "string" &&
		body.message.trim().length > 0 &&
		typeof body.sessionId === "string" &&
		body.sessionId.length > 0 &&
		typeof body.projectId === "string" &&
		body.projectId.length > 0
	);
}
```

Remove the unused `ModelMessage` import.

- [ ] **Step 2: Update parser tests**

In `src/server/ai/streaming-request.test.ts`, change the missing-fields test request body to:

```ts
body: JSON.stringify({ message: "hello" }),
```

Change the valid input test body to:

```ts
body: JSON.stringify({
	message: "hello",
	projectId: "project-1",
	sessionId: "session-1",
}),
```

Change the expected parsed result to:

```ts
assert.deepEqual(body, {
	message: "hello",
	projectId: "project-1",
	sessionId: "session-1",
});
```

- [ ] **Step 3: Update Route Handler destructuring and call**

In `src/app/api/chat/stream/route.ts`, replace:

```ts
const { messages, sessionId, projectId } =
	await parseStreamingChatRequest(request);
const streamingChat = await startStreamingSessionChat({
	db,
	userId: session.user.id,
	sessionId,
	projectId,
	incomingMessages: messages,
});
```

with:

```ts
const { message, sessionId, projectId } =
	await parseStreamingChatRequest(request);
const streamingChat = await startStreamingSessionChat({
	db,
	userId: session.user.id,
	sessionId,
	projectId,
	message,
});
```

- [ ] **Step 4: Run request and streaming tests**

Run:

```bash
npm run test -- src/server/ai/streaming-request.test.ts src/server/ai/streaming-session.test.ts src/server/ai/session-turn.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the request shape change**

```bash
git add src/server/ai/streaming-request.ts src/server/ai/streaming-request.test.ts src/app/api/chat/stream/route.ts
git commit -m "refactor: stream only current session message"
```

---

### Task 6: Adapt ChatPanel Streaming Fetch

**Files:**
- Modify: `src/app/_components/chat-panel.tsx`
- Test: `src/app/_components/chat-panel-helpers.test.ts`

- [ ] **Step 1: Remove client-sent history from streaming fetch**

In `src/app/_components/chat-panel.tsx`, inside `handleSend`, delete:

```ts
const allMessages = [
	...(sessionData?.messages ?? []),
	{ role: "user", content: trimmed },
];
```

Replace the fetch body:

```ts
body: JSON.stringify({
	messages: allMessages,
	sessionId: activeSessionId,
	projectId,
}),
```

with:

```ts
body: JSON.stringify({
	message: trimmed,
	sessionId: activeSessionId,
	projectId,
}),
```

Remove `sessionData` from the `handleSend` dependency array if it is no longer used by `handleSend`.

- [ ] **Step 2: Run component helper tests and typecheck**

Run:

```bash
npm run test -- src/app/_components/chat-panel-helpers.test.ts
npm run typecheck
```

Expected: both PASS. Typecheck should catch any stale `sessionData` dependency or request shape mismatch.

- [ ] **Step 3: Commit the UI request adaptation**

```bash
git add src/app/_components/chat-panel.tsx
git commit -m "refactor: send current chat message to stream endpoint"
```

---

### Task 7: Add Revision Proposal Success Coverage

**Files:**
- Modify: `src/server/ai/session-turn.test.ts`
- Test: `src/server/ai/session-turn.ts`

- [ ] **Step 1: Add a test for revision proposal creation and persistence**

Append this test to `src/server/ai/session-turn.test.ts`:

```ts
test("sendAISessionTurn creates a revision proposal for edit intent before chat fallback", async () => {
	const plainDoc = JSON.stringify({
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [
					{
						type: "text",
						text: "这是一段足够长的原文，用来验证替换目标必须唯一并且足够安全。",
					},
				],
			},
		],
	});
	let proposalCreateArgs: unknown = null;
	let generatedChat = false;
	const db = {
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
		aISession: {
			findFirst: async () => ({
				id: "session-1",
				projectId: "project-1",
				chapterId: "chapter-1",
				title: null,
				messages: "[]",
			}),
			update: async (args: unknown) => ({
				id: "session-1",
				title: JSON.parse((args as { data: { messages: string } }).data.messages)[0].content,
				updatedAt: new Date("2026-05-15T00:00:00.000Z"),
			}),
		},
		chapter: {
			findFirst: async () => ({
				id: "chapter-1",
				projectId: "project-1",
				title: "Chapter",
				content: plainDoc,
				wordCount: 1,
				summary: null,
				updatedAt: new Date("2026-05-15T00:00:00.000Z"),
			}),
		},
		chapterRevisionProposal: {
			create: async (args: unknown) => {
				proposalCreateArgs = args;
				return { id: "proposal-1" };
			},
		},
	};

	const result = await sendAISessionTurn({
		db: db as never,
		userId: "user-1",
		sessionId: "session-1",
		message: "请润色这一段",
		dependencies: {
			assembleContext: async () => [],
			createLLMClient: () => ({
				generateObject: async () => ({
					object: {
						operation: "replace",
						instruction: "润色表达",
						targetHint: "开头段落",
						originalText: "这是一段足够长的原文，用来验证替换目标必须唯一并且足够安全。",
						replacementText: "这是一段更流畅的改写，用来验证提案可以被正确创建。",
					},
				}),
				generate: async () => {
					generatedChat = true;
					return { text: "fallback" };
				},
			}),
			createToolRegistry: () => ({}) as never,
		},
	});

	assert.equal(generatedChat, false);
	assert.equal(result.message.proposalId, "proposal-1");
	assert.deepEqual(proposalCreateArgs, {
		data: {
			projectId: "project-1",
			chapterId: "chapter-1",
			sessionId: "session-1",
			status: "pending",
			operation: "replace",
			instruction: "润色表达",
			targetHint: "开头段落",
			originalText: "这是一段足够长的原文，用来验证替换目标必须唯一并且足够安全。",
			replacementText: "这是一段更流畅的改写，用来验证提案可以被正确创建。",
			baseContentHash: assert.match,
		},
	});
});
```

If `assert.match` cannot be used inside `deepEqual`, replace the final assertion with:

```ts
const data = (proposalCreateArgs as { data: Record<string, unknown> }).data;
assert.equal(data.projectId, "project-1");
assert.equal(data.chapterId, "chapter-1");
assert.equal(data.sessionId, "session-1");
assert.equal(data.status, "pending");
assert.equal(data.operation, "replace");
assert.equal(data.instruction, "润色表达");
assert.equal(data.targetHint, "开头段落");
assert.equal(data.originalText, "这是一段足够长的原文，用来验证替换目标必须唯一并且足够安全。");
assert.equal(data.replacementText, "这是一段更流畅的改写，用来验证提案可以被正确创建。");
assert.equal(typeof data.baseContentHash, "string");
```

- [ ] **Step 2: Run the test and verify it fails if proposal path is incomplete**

Run:

```bash
npm run test -- src/server/ai/session-turn.test.ts
```

Expected: PASS if Task 2 already implemented proposal creation correctly; otherwise FAIL with a specific missing field or fallback-chat assertion.

- [ ] **Step 3: Fix `session-turn.ts` only if needed**

If the test fails because the proposal path does not persist or returns the wrong assistant message, update only `tryCreateRevisionProposal` or `sendAISessionTurn` in `src/server/ai/session-turn.ts` until the test passes.

- [ ] **Step 4: Commit revision proposal coverage**

```bash
git add src/server/ai/session-turn.test.ts src/server/ai/session-turn.ts
git commit -m "test: cover revision proposal session turns"
```

---

### Task 8: Final Verification and Cleanup

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused server tests**

Run:

```bash
npm run test -- src/server/ai/session-turn.test.ts src/server/ai/streaming-session.test.ts src/server/ai/streaming-request.test.ts src/server/services/revision-proposal.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run Biome check**

Run:

```bash
npm run check
```

Expected: PASS. If formatting fails only because of changed files, run `npm run check:write`, inspect the diff, then rerun `npm run check`.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git diff --stat
git diff -- src/server/ai/session-turn.ts src/server/api/routers/session.ts src/server/ai/streaming-request.ts src/app/api/chat/stream/route.ts src/app/_components/chat-panel.tsx
```

Expected: Diff shows the new deep Module, slim router/route adapters, narrowed streaming request shape, and no Prisma schema change.

- [ ] **Step 6: Commit final cleanup if needed**

If Task 8 produced formatting-only or small cleanup changes:

```bash
git add src/server/ai/session-turn.ts src/server/api/routers/session.ts src/server/ai/streaming-session.ts src/server/ai/streaming-request.ts src/app/api/chat/stream/route.ts src/app/_components/chat-panel.tsx src/server/ai/*.test.ts
git commit -m "chore: verify ai session turn refactor"
```

If there are no changes after verification, do not create an empty commit.

---

## Self-Review

**Spec coverage:** The plan covers the agreed decisions: revision proposals are inside the AI session turn Module; non-streaming and streaming remain separate external Interfaces; streaming rejects revision-like input server-side; DB history is authoritative; schema remains unchanged; production creates LLM/context/tools internally while tests inject dependencies; first implementation focuses on server with minimal `ChatPanel` adaptation; revision fallback remains internal and logged.

**Placeholder scan:** No `TBD`, `TODO`, "implement later", or generic "write tests" placeholders remain. Each code-changing task includes concrete file paths, code snippets, commands, and expected results.

**Type consistency:** The plan consistently uses `sendAISessionTurn`, `startStreamingAISessionTurn`, `AISessionTurnError`, `parseStoredSessionMessages`, and the narrowed streaming request field `message`.
