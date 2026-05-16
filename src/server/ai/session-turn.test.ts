import assert from "node:assert/strict";
import test from "node:test";
import {
	appendSessionMessages,
	buildSessionContextMessages,
	buildUserSessionMessage,
	MINIMAL_SYSTEM_PROMPT,
	parseStoredSessionMessages,
	readSessionMessages,
} from "./session-turn";

test("parseStoredSessionMessages keeps only stored chat-like messages", () => {
	assert.deepEqual(parseStoredSessionMessages("{"), []);
	assert.deepEqual(
		parseStoredSessionMessages(
			JSON.stringify([
				{ role: "assistant", content: "ok", toolCalls: [{ name: "x" }] },
				{ role: "user" },
				null,
			]),
		),
		[{ role: "assistant", content: "ok", toolCalls: [{ name: "x" }] }],
	);
});

test("buildUserSessionMessage formats selection operations", () => {
	assert.deepEqual(buildUserSessionMessage({ message: "hello" }), {
		role: "user",
		content: "hello",
	});
	assert.deepEqual(
		buildUserSessionMessage({
			message: "ignored",
			selectionContext: {
				selectedText: "A paragraph",
				beforeContext: "",
				afterContext: "",
				operation: "polish",
			},
		}),
		{
			role: "user",
			content: "润色选中的文字：A paragraph",
		},
	);
});

test("buildSessionContextMessages uses minimal prompt for unbound sessions", async () => {
	const messages = await buildSessionContextMessages({
		db: {} as never,
		projectId: "project-1",
		chapterId: null,
		dependencies: {
			assembleContext: async () => {
				throw new Error("should not assemble chapter context");
			},
		},
	});

	assert.deepEqual(messages, [
		{ role: "system", content: MINIMAL_SYSTEM_PROMPT },
	]);
});

test("readSessionMessages returns legacy JSON followed by normalized messages", async () => {
	const messages = await readSessionMessages({
		db: {
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
					return [
						{
							role: "assistant",
							content: "new",
							metadata: { proposalId: "proposal-1" },
						},
					];
				},
			},
		} as never,
		sessionId: "session-1",
		legacyMessages: JSON.stringify([{ role: "user", content: "old" }]),
	});

	assert.deepEqual(messages, [
		{ role: "user", content: "old" },
		{ role: "assistant", content: "new", proposalId: "proposal-1" },
	]);
});

test("appendSessionMessages appends rows, touches the session, and seeds missing titles", async () => {
	let updateArgs: unknown = null;
	let createManyArgs: unknown = null;
	let transactionUsed = false;
	const beforeAppend = Date.now();
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
					title: null,
				};
			},
			update: async (args: unknown) => {
				updateArgs = args;
				return { id: "session-1", title: "new title" };
			},
		},
		aISessionMessage: {
			createMany: async (args: unknown) => {
				createManyArgs = args;
				return { count: 2 };
			},
		},
	};

	const updated = await appendSessionMessages({
		db: db as never,
		userId: "user-1",
		sessionId: "session-1",
		titleSeed: "new title",
		messages: [
			{ role: "user", content: "hello" },
			{ role: "assistant", content: "hi" },
		],
	});

	assert.deepEqual(updated, { id: "session-1", title: "new title" });
	assert.equal(transactionUsed, true);
	assert.deepEqual(createManyArgs, {
		data: [
			{
				sessionId: "session-1",
				role: "user",
				content: "hello",
			},
			{
				sessionId: "session-1",
				role: "assistant",
				content: "hi",
			},
		],
	});
	const update = updateArgs as {
		where: { id: string };
		data: { title?: string; updatedAt: Date };
	};
	assert.deepEqual(update.where, { id: "session-1" });
	assert.equal(update.data.title, "new title");
	assert.ok(update.data.updatedAt.getTime() >= beforeAppend);
});
