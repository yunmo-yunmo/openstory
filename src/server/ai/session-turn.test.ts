import assert from "node:assert/strict";
import test from "node:test";
import {
	appendSessionMessages,
	buildSessionContextMessages,
	buildUserSessionMessage,
	MINIMAL_SYSTEM_PROMPT,
	parseStoredSessionMessages,
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

test("appendSessionMessages atomically appends and seeds missing titles", async () => {
	const storedMessages = [{ role: "assistant", content: "previous" }];
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
					title: null,
					messages: JSON.stringify(storedMessages),
				};
			},
			update: async (args: unknown) => {
				updateArgs = args;
				return { id: "session-1", title: "new title" };
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
	assert.deepEqual(updateArgs, {
		where: { id: "session-1" },
		data: {
			messages: JSON.stringify([
				...storedMessages,
				{ role: "user", content: "hello" },
				{ role: "assistant", content: "hi" },
			]),
			title: "new title",
		},
	});
});
