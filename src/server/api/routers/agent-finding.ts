import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { createTRPCRouter, protectedProcedure } from "../trpc";

type FindingListItem = {
	severity: string;
	createdAt: Date;
};

type FindingStatus = "ignored" | "resolved";
type RouterBuilder = typeof createTRPCRouter;
type ProtectedProcedure = typeof protectedProcedure;

const severityRank: Record<string, number> = {
	high: 3,
	medium: 2,
	low: 1,
};

export function sortFindingsForList<T extends FindingListItem>(
	findings: T[],
): T[] {
	return [...findings].sort((a, b) => {
		const severityDelta =
			(severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);
		if (severityDelta !== 0) return severityDelta;
		return b.createdAt.getTime() - a.createdAt.getTime();
	});
}

export function buildChapterOwnershipWhere(chapterId: string, userId: string) {
	return {
		id: chapterId,
		project: { userId },
	};
}

export function buildFindingStatusUpdate(
	id: string,
	userId: string,
	status: FindingStatus,
) {
	return {
		where: {
			id,
			project: { userId },
		},
		data: { status },
	};
}

async function updateFindingStatus(
	db: {
		agentFinding: {
			updateMany: (
				args: ReturnType<typeof buildFindingStatusUpdate>,
			) => Promise<{
				count: number;
			}>;
		};
	},
	id: string,
	userId: string,
	status: FindingStatus,
) {
	const result = await db.agentFinding.updateMany(
		buildFindingStatusUpdate(id, userId, status),
	);
	if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
	return { id, status };
}

export function createAgentFindingRouter({
	createTRPCRouter,
	protectedProcedure,
}: {
	createTRPCRouter: RouterBuilder;
	protectedProcedure: ProtectedProcedure;
}) {
	return createTRPCRouter({
		listByChapter: protectedProcedure
			.input(z.object({ chapterId: z.string() }))
			.query(async ({ ctx, input }) => {
				const chapter = await ctx.db.chapter.findFirst({
					where: buildChapterOwnershipWhere(
						input.chapterId,
						ctx.session.user.id,
					),
					select: { id: true, projectId: true },
				});

				if (!chapter) throw new TRPCError({ code: "NOT_FOUND" });

				const findings = await ctx.db.agentFinding.findMany({
					where: {
						chapterId: chapter.id,
						projectId: chapter.projectId,
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

				return sortFindingsForList(findings);
			}),

		ignore: protectedProcedure
			.input(z.object({ id: z.string() }))
			.mutation(({ ctx, input }) =>
				updateFindingStatus(ctx.db, input.id, ctx.session.user.id, "ignored"),
			),

		resolve: protectedProcedure
			.input(z.object({ id: z.string() }))
			.mutation(({ ctx, input }) =>
				updateFindingStatus(ctx.db, input.id, ctx.session.user.id, "resolved"),
			),
	});
}

export const agentFindingRouter = createAgentFindingRouter;
