import assert from "node:assert/strict";
import test from "node:test";
import type { ModelMessage } from "ai";
import {
	StreamingSessionError,
	startStreamingSessionChat,
} from "./streaming-session";

test("startStreamingSessionChat streams with server-side chapter context and tools", async () => {
	const storedMessages = [{ role: "assistant", content: "previous reply" }];
	const contextMessages: ModelMessage[] = [
		{ role: "system", content: "chapter context" },
	];
	const tools = { read_chapters: { description: "tool" } };
	const toolCalls = [{ name: "read_chapters", args: { ids: ["chapter-1"] } }];
	const toolResults = [{ name: "read_chapters", result: "chapter text" }];
	let streamArgs: {
		task: string;
		messages: ModelMessage[];
		tools?: unknown;
		maxTokens?: number;
		temperature?: number;
	} | null = null;
	const registryProjectIds: string[] = [];
	let updateArgs: unknown = null;
	let createManyArgs: unknown = null;
	let transactionUsed = false;
	const beforePersist = Date.now();

	const db = {
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
			transactionUsed = true;
			return callback(db);
		},
		aISession: {
			findFirst: async ({
				where,
			}: {
				where: { id: string; project?: { userId: string } };
			}) => {
				assert.equal(where.id, "session-1");
				assert.equal(where.project?.userId, "user-1");
				return {
					id: "session-1",
					projectId: "project-1",
					chapterId: "chapter-1",
					title: null,
					messages: JSON.stringify(storedMessages),
				};
			},
			update: async (args: unknown) => {
				updateArgs = args;
				return {};
			},
		},
		aISessionMessage: {
			findMany: async (args: unknown) => {
				assert.deepEqual(args, {
					where: { sessionId: "session-1" },
					orderBy: { id: "asc" },
					select: {
						role: true,
						content: true,
						metadata: true,
					},
				});
				return [];
			},
			createMany: async (args: unknown) => {
				createManyArgs = args;
				return { count: 2 };
			},
		},
	};

	const result = await startStreamingSessionChat({
		db: db as never,
		userId: "user-1",
		sessionId: "session-1",
		projectId: "project-1",
		message: "talk about the scene",
		dependencies: {
			assembleContext: async (args) => {
				assert.equal(args.projectId, "project-1");
				assert.equal(args.currentChapterId, "chapter-1");
				return contextMessages;
			},
			createLLMClient: () => ({
				stream: async (args) => {
					streamArgs = args;
					return {
						textStream: (async function* () {
							yield "assistant";
						})(),
						toolCalls: Promise.resolve(toolCalls),
						toolResults: Promise.resolve(toolResults),
					};
				},
			}),
			createToolRegistry: (args) => {
				registryProjectIds.push(args.projectId);
				return tools as never;
			},
		},
	});

	assert.deepEqual(registryProjectIds, ["project-1"]);
	assert.deepEqual(streamArgs, {
		task: "chat",
		messages: [
			...contextMessages,
			...storedMessages,
			{ role: "user", content: "talk about the scene" },
		],
		tools,
		maxTokens: 4096,
		temperature: 0.7,
	});

	await result.persist("assistant response");

	assert.deepEqual(createManyArgs, {
		data: [
			{
				sessionId: "session-1",
				role: "user",
				content: "talk about the scene",
			},
			{
				sessionId: "session-1",
				role: "assistant",
				content: "assistant response",
				metadata: { toolCalls, toolResults },
			},
		],
	});
	const update = updateArgs as {
		where: { id: string };
		data: { title?: string; updatedAt: Date };
	};
	assert.deepEqual(update.where, { id: "session-1" });
	assert.equal(update.data.title, "talk about the scene");
	assert.ok(update.data.updatedAt.getTime() >= beforePersist);
	assert.equal(transactionUsed, true);
});

test("startStreamingSessionChat rejects project mismatches before streaming", async () => {
	const db = {
		aISession: {
			findFirst: async () => ({
				id: "session-1",
				projectId: "project-actual",
				chapterId: "chapter-1",
				title: "Session",
				messages: "[]",
			}),
		},
	};
	let streamed = false;

	await assert.rejects(
		startStreamingSessionChat({
			db: db as never,
			userId: "user-1",
			sessionId: "session-1",
			projectId: "project-requested",
			message: "hello",
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
		/Session project mismatch/,
	);

	assert.equal(streamed, false);
});

test("startStreamingSessionChat rejects revision intent before streaming", async () => {
	const db = {
		aISession: {
			findFirst: async () => ({
				id: "session-1",
				projectId: "project-1",
				chapterId: "chapter-1",
				title: "Session",
				messages: "[]",
			}),
		},
	};
	let streamed = false;

	await assert.rejects(
		startStreamingSessionChat({
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
			error instanceof StreamingSessionError &&
			error.status === 409 &&
			error.message === "Non-streaming required",
	);

	assert.equal(streamed, false);
});
