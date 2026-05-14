import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TRPCError } from "@trpc/server";
import {
	buildChapterOwnershipWhere,
	buildFindingStatusUpdate,
	createAgentFindingRouter,
	sortFindingsForList,
} from "./agent-finding";

type ResolverArgs = {
	ctx: {
		db: {
			chapter: {
				findFirst: (args: unknown) => Promise<unknown>;
			};
			agentFinding: {
				findMany: (args: unknown) => Promise<unknown[]>;
				updateMany: (args: unknown) => Promise<{ count: number }>;
			};
		};
		session: { user: { id: string } };
	};
	input: Record<string, string>;
};

type QueryResolver = (args: ResolverArgs) => Promise<unknown>;
type MutationResolver = (args: ResolverArgs) => Promise<unknown>;

function createTestRouter() {
	const protectedProcedure = {
		input: () => ({
			query: (resolver: QueryResolver) => resolver,
			mutation: (resolver: MutationResolver) => resolver,
		}),
	};

	return createAgentFindingRouter({
		createTRPCRouter: (procedures: unknown) => procedures,
		protectedProcedure,
	} as never) as unknown as {
		listByChapter: QueryResolver;
		ignore: MutationResolver;
		resolve: MutationResolver;
	};
}

function createCtx({
	chapter,
	findings = [],
	updateCount = 1,
}: {
	chapter?: unknown;
	findings?: unknown[];
	updateCount?: number;
}) {
	const calls: {
		chapterFindFirst?: unknown;
		findingFindMany?: unknown;
		findingUpdateMany?: unknown;
	} = {};

	const ctx: ResolverArgs["ctx"] = {
		db: {
			chapter: {
				findFirst: async (args) => {
					calls.chapterFindFirst = args;
					return chapter ?? null;
				},
			},
			agentFinding: {
				findMany: async (args) => {
					calls.findingFindMany = args;
					return findings;
				},
				updateMany: async (args) => {
					calls.findingUpdateMany = args;
					return { count: updateCount };
				},
			},
		},
		session: { user: { id: "user-1" } },
	};

	return { calls, ctx };
}

describe("agent finding router helpers", () => {
	test("sorts open findings by severity high to low, then newest first", () => {
		const older = new Date("2026-05-10T00:00:00.000Z");
		const newer = new Date("2026-05-11T00:00:00.000Z");

		const sorted = sortFindingsForList([
			{ id: "low-new", severity: "low", createdAt: newer },
			{ id: "high-old", severity: "high", createdAt: older },
			{ id: "medium-new", severity: "medium", createdAt: newer },
			{ id: "high-new", severity: "high", createdAt: newer },
		]);

		assert.deepEqual(
			sorted.map((finding) => finding.id),
			["high-new", "high-old", "medium-new", "low-new"],
		);
	});

	test("builds chapter ownership filter through chapter project user", () => {
		assert.deepEqual(buildChapterOwnershipWhere("chapter-1", "user-1"), {
			id: "chapter-1",
			project: { userId: "user-1" },
		});
	});

	test("builds scoped ignored status update without cross-user mutation", () => {
		assert.deepEqual(
			buildFindingStatusUpdate("finding-1", "user-1", "ignored"),
			{
				where: {
					id: "finding-1",
					project: { userId: "user-1" },
				},
				data: { status: "ignored" },
			},
		);
	});

	test("builds scoped resolved status update without cross-user mutation", () => {
		assert.deepEqual(
			buildFindingStatusUpdate("finding-1", "user-1", "resolved"),
			{
				where: {
					id: "finding-1",
					project: { userId: "user-1" },
				},
				data: { status: "resolved" },
			},
		);
	});
});

describe("agent finding router procedures", () => {
	test("listByChapter throws NOT_FOUND when chapter lookup returns null", async () => {
		const router = createTestRouter();
		const { ctx } = createCtx({});

		await assert.rejects(
			router.listByChapter({ ctx, input: { chapterId: "chapter-1" } }),
			(error) => error instanceof TRPCError && error.code === "NOT_FOUND",
		);
	});

	test("listByChapter queries open findings for the scoped chapter and sorts them", async () => {
		const router = createTestRouter();
		const older = new Date("2026-05-10T00:00:00.000Z");
		const newer = new Date("2026-05-11T00:00:00.000Z");
		const { calls, ctx } = createCtx({
			chapter: { id: "chapter-1", projectId: "project-1" },
			findings: [
				{ id: "low-new", severity: "low", createdAt: newer },
				{ id: "high-old", severity: "high", createdAt: older },
				{ id: "medium-new", severity: "medium", createdAt: newer },
				{ id: "high-new", severity: "high", createdAt: newer },
			],
		});

		const result = (await router.listByChapter({
			ctx,
			input: { chapterId: "chapter-1" },
		})) as Array<{ id: string }>;

		assert.deepEqual(calls.chapterFindFirst, {
			where: { id: "chapter-1", project: { userId: "user-1" } },
			select: { id: true, projectId: true },
		});
		assert.deepEqual(calls.findingFindMany, {
			where: {
				chapterId: "chapter-1",
				projectId: "project-1",
				status: "open",
			},
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				type: true,
				category: true,
				severity: true,
				title: true,
				description: true,
				locations: true,
				status: true,
				createdAt: true,
			},
		});
		assert.deepEqual(
			result.map((finding) => finding.id),
			["high-new", "high-old", "medium-new", "low-new"],
		);
	});

	test("ignore maps updateMany count 0 to TRPCError NOT_FOUND", async () => {
		const router = createTestRouter();
		const { calls, ctx } = createCtx({ updateCount: 0 });

		await assert.rejects(
			router.ignore({ ctx, input: { id: "finding-1" } }),
			(error) => error instanceof TRPCError && error.code === "NOT_FOUND",
		);
		assert.deepEqual(calls.findingUpdateMany, {
			where: {
				id: "finding-1",
				project: { userId: "user-1" },
			},
			data: { status: "ignored" },
		});
	});

	test('resolve returns { id, status: "resolved" } on count 1', async () => {
		const router = createTestRouter();
		const { calls, ctx } = createCtx({ updateCount: 1 });

		const result = await router.resolve({
			ctx,
			input: { id: "finding-1" },
		});

		assert.deepEqual(calls.findingUpdateMany, {
			where: {
				id: "finding-1",
				project: { userId: "user-1" },
			},
			data: { status: "resolved" },
		});
		assert.deepEqual(result, { id: "finding-1", status: "resolved" });
	});
});
