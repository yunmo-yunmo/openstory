import assert from "node:assert/strict";
import test from "node:test";
import type { ModelMessage } from "ai";
import { startStreamingSessionChat } from "./streaming-session";

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
	let transactionUsed = false;

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
	};

	const result = await startStreamingSessionChat({
		db: db as never,
		userId: "user-1",
		sessionId: "session-1",
		projectId: "project-1",
		incomingMessages: [{ role: "user", content: "continue the scene" }],
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
			{ role: "user", content: "continue the scene" },
		],
		tools,
		maxTokens: 4096,
		temperature: 0.7,
	});

	await result.persist("assistant response");

	assert.deepEqual(updateArgs, {
		where: { id: "session-1" },
		data: {
			messages: JSON.stringify([
				...storedMessages,
				{ role: "user", content: "continue the scene" },
				{
					role: "assistant",
					content: "assistant response",
					toolCalls,
					toolResults,
				},
			]),
			title: "continue the scene",
		},
	});
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
			incomingMessages: [{ role: "user", content: "hello" }],
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
