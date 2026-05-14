import assert from "node:assert/strict";
import test from "node:test";
import type { ConsistencyIssue } from "./agent-runner";
import { runBackgroundAgents } from "./agent-runner";

const db = { id: "db" } as never;
const llmClient = { id: "llm-client" } as never;

test("runBackgroundAgents persists successful consistency results", async () => {
	const issues: ConsistencyIssue[] = [
		{
			type: "plot",
			severity: "high",
			description: "The door was locked, then opened without a key.",
			locations: ["Chapter 3"],
		},
	];
	let persisted: {
		db: unknown;
		projectId: string;
		chapterId: string;
		issues: ConsistencyIssue[];
	} | null = null;

	const result = await runBackgroundAgents({
		db,
		userId: "user-1",
		projectId: "project-1",
		chapterId: "chapter-1",
		dependencies: {
			createLLMClient: () => llmClient,
			generateChapterSummary: async () => "chapter summary",
			checkChapterConsistency: async () => issues,
			persistConsistencyFindings: async (receivedDb, input) => {
				persisted = { db: receivedDb, ...input };
			},
		},
	});

	assert.deepEqual(persisted, {
		db,
		projectId: "project-1",
		chapterId: "chapter-1",
		issues,
	});
	assert.deepEqual(result, {
		summary: "chapter summary",
		consistencyIssues: issues,
		errors: [],
	});
});

test("runBackgroundAgents reports persistence errors without throwing or dropping consistency results", async () => {
	const issues: ConsistencyIssue[] = [
		{
			type: "timeline",
			severity: "medium",
			description: "The evening scene refers to sunrise.",
			locations: ["Chapter 7"],
		},
	];

	const result = await runBackgroundAgents({
		db,
		userId: "user-1",
		projectId: "project-1",
		chapterId: "chapter-1",
		dependencies: {
			createLLMClient: () => llmClient,
			generateChapterSummary: async () => "chapter summary",
			checkChapterConsistency: async () => issues,
			persistConsistencyFindings: async () => {
				throw new Error("database unavailable");
			},
		},
	});

	assert.equal(result.summary, "chapter summary");
	assert.deepEqual(result.consistencyIssues, issues);
	assert.deepEqual(result.errors, [
		"Consistency finding persistence failed: database unavailable",
	]);
});
