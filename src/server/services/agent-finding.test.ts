import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ConsistencyIssue } from "../ai/tools/check-consistency";
import {
	buildFindingRevisionPrompt,
	persistConsistencyFindings,
} from "./agent-finding";

type DeleteManyCall = {
	where: Record<string, unknown>;
};

type CreateManyCall = {
	data: Array<Record<string, unknown>>;
};

type MockDb = {
	agentFinding: {
		deleteMany: (args: DeleteManyCall) => { count: number };
		createMany: (args: CreateManyCall) => { count: number };
		findMany: (args: {
			where: Record<string, unknown>;
			select: {
				category: true;
				severity: true;
				description: true;
			};
		}) => Promise<
			Array<{
				category: string;
				severity: string;
				description: string;
			}>
		>;
	};
	$transaction: <T>(fn: (tx: MockDb) => T | Promise<T>) => Promise<T>;
};

function createMockDb({
	terminalFindings = [],
}: {
	terminalFindings?: Array<{
		category: string;
		severity: string;
		description: string;
	}>;
} = {}) {
	const calls: {
		transactionCount: number;
		deleteMany: DeleteManyCall[];
		createMany: CreateManyCall[];
		findMany: Array<{ where: Record<string, unknown> }>;
	} = {
		transactionCount: 0,
		deleteMany: [],
		createMany: [],
		findMany: [],
	};

	const db: MockDb = {
		agentFinding: {
			deleteMany: (args: DeleteManyCall) => {
				calls.deleteMany.push(args);
				return { count: 1 };
			},
			createMany: (args: CreateManyCall) => {
				calls.createMany.push(args);
				return { count: args.data.length };
			},
			findMany: async (args: { where: Record<string, unknown> }) => {
				calls.findMany.push(args);
				return terminalFindings;
			},
		},
		$transaction: async <T>(fn: (tx: typeof db) => T | Promise<T>) => {
			calls.transactionCount += 1;
			return await fn(db);
		},
	};

	return { db, calls };
}

describe("persistConsistencyFindings", () => {
	test("replaces open background consistency findings for the same project and chapter", async () => {
		const { db, calls } = createMockDb();

		await persistConsistencyFindings(db, {
			projectId: "project-1",
			chapterId: "chapter-1",
			issues: [],
		});

		assert.equal(calls.transactionCount, 1);
		assert.deepEqual(calls.deleteMany[0]?.where, {
			projectId: "project-1",
			chapterId: "chapter-1",
			type: "consistency_issue",
			source: "background_agent",
			status: "open",
		});
	});

	test("maps consistency issues to agent finding create payloads", async () => {
		const { db, calls } = createMockDb();
		const issues: ConsistencyIssue[] = [
			{
				type: "continuity",
				description: "主角在上一章已经丢失钥匙，但本章开头直接用钥匙开门。",
				severity: "high",
				locations: ["第2段", "门口场景"],
			},
			{
				type: "timeline",
				description: "傍晚之后又出现清晨阳光。",
				severity: "medium",
				locations: [],
			},
		];

		await persistConsistencyFindings(db, {
			projectId: "project-1",
			chapterId: "chapter-1",
			issues,
		});

		assert.deepEqual(calls.createMany[0]?.data, [
			{
				projectId: "project-1",
				chapterId: "chapter-1",
				type: "consistency_issue",
				category: "continuity",
				severity: "high",
				title: "主角在上一章已经丢失钥匙，但本章开头直接用钥匙开门。",
				description: "主角在上一章已经丢失钥匙，但本章开头直接用钥匙开门。",
				locations: ["第2段", "门口场景"],
				status: "open",
				source: "background_agent",
			},
			{
				projectId: "project-1",
				chapterId: "chapter-1",
				type: "consistency_issue",
				category: "timeline",
				severity: "medium",
				title: "傍晚之后又出现清晨阳光。",
				description: "傍晚之后又出现清晨阳光。",
				locations: [],
				status: "open",
				source: "background_agent",
			},
		]);
	});

	test("cleans up old open findings and creates none for empty issues", async () => {
		const { db, calls } = createMockDb();

		await persistConsistencyFindings(db, {
			projectId: "project-1",
			chapterId: "chapter-1",
			issues: [],
		});

		assert.equal(calls.deleteMany.length, 1);
		assert.equal(calls.createMany.length, 0);
	});

	test("preserves ignored and resolved findings by deleting only open findings", async () => {
		const { db, calls } = createMockDb();

		await persistConsistencyFindings(db, {
			projectId: "project-1",
			chapterId: "chapter-1",
			issues: [],
		});

		assert.equal(calls.deleteMany[0]?.where.status, "open");
		assert.equal(calls.deleteMany[0]?.where.type, "consistency_issue");
		assert.equal(calls.deleteMany[0]?.where.source, "background_agent");
	});

	test("does not recreate ignored or resolved findings with the same issue identity", async () => {
		const { db, calls } = createMockDb({
			terminalFindings: [
				{
					category: "continuity",
					severity: "high",
					description: "主角在上一章已经丢失钥匙，但本章开头直接用钥匙开门。",
				},
			],
		});

		await persistConsistencyFindings(db, {
			projectId: "project-1",
			chapterId: "chapter-1",
			issues: [
				{
					type: "continuity",
					description: "主角在上一章已经丢失钥匙，但本章开头直接用钥匙开门。",
					severity: "high",
					locations: ["第2段"],
				},
				{
					type: "timeline",
					description: "傍晚之后又出现清晨阳光。",
					severity: "medium",
					locations: [],
				},
			],
		});

		assert.deepEqual(calls.findMany[0], {
			where: {
				projectId: "project-1",
				chapterId: "chapter-1",
				type: "consistency_issue",
				source: "background_agent",
				status: { in: ["ignored", "resolved"] },
			},
			select: {
				category: true,
				severity: true,
				description: true,
			},
		});
		assert.deepEqual(calls.createMany[0]?.data, [
			{
				projectId: "project-1",
				chapterId: "chapter-1",
				type: "consistency_issue",
				category: "timeline",
				severity: "medium",
				title: "傍晚之后又出现清晨阳光。",
				description: "傍晚之后又出现清晨阳光。",
				locations: [],
				status: "open",
				source: "background_agent",
			},
		]);
	});

	test("truncates titles to 80 chars with an ellipsis", async () => {
		const { db, calls } = createMockDb();
		const description = `${"a".repeat(80)} extra text`;

		await persistConsistencyFindings(db, {
			projectId: "project-1",
			chapterId: "chapter-1",
			issues: [
				{
					type: "other",
					description,
					severity: "low",
					locations: [],
				},
			],
		});

		assert.equal(calls.createMany[0]?.data[0]?.title, `${"a".repeat(80)}...`);
	});
});

describe("buildFindingRevisionPrompt", () => {
	test("includes Chinese edit intent, description, and locations", () => {
		const prompt = buildFindingRevisionPrompt({
			description: "角色在上一章受伤，本章却能立刻奔跑。",
			locations: ["第4段", "追逐场景"],
		});

		assert.match(prompt, /请根据以下一致性问题修改当前章节/);
		assert.match(prompt, /角色在上一章受伤，本章却能立刻奔跑。/);
		assert.match(prompt, /第4段、追逐场景/);
	});
});
