import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { runBackgroundAgents } from "~/server/ai/agents/agent-runner";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
	acceptRevisionProposal,
	rejectRevisionProposal,
} from "~/server/services/revision-proposal";

type AcceptDb = Parameters<typeof acceptRevisionProposal>[0];
type RejectDb = Parameters<typeof rejectRevisionProposal>[0];

function throwForResult(
	result: { ok: false; code: string; message: string },
): never {
	const codeMap: Record<string, "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT"> = {
		NOT_FOUND: "NOT_FOUND",
		BAD_REQUEST: "BAD_REQUEST",
		CONFLICT: "CONFLICT",
	};
	throw new TRPCError({
		code: codeMap[result.code] ?? "BAD_REQUEST",
		message: result.message,
	});
}

export const revisionProposalRouter = createTRPCRouter({
	listBySession: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const session = await ctx.db.aISession.findFirst({
				where: {
					id: input.sessionId,
					project: { userId: ctx.session.user.id },
				},
			});

			if (!session) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return ctx.db.chapterRevisionProposal.findMany({
				where: { sessionId: input.sessionId },
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					status: true,
					operation: true,
					instruction: true,
					targetHint: true,
					originalText: true,
					replacementText: true,
					createdAt: true,
					decidedAt: true,
				},
			});
		}),

	accept: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const result = await acceptRevisionProposal(ctx.db as unknown as AcceptDb, {
				proposalId: input.id,
				userId: ctx.session.user.id,
			});

			if (!result.ok) {
				throwForResult(result);
			}

			runBackgroundAgents({
				db: ctx.db,
				userId: ctx.session.user.id,
				projectId: result.projectId,
				chapterId: result.chapterId,
			}).catch((error) => {
				console.error("[revisionProposal.accept] background agents failed:", error);
			});

			return {
				proposalId: result.proposal.id,
				status: result.proposal.status,
			};
		}),

	reject: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const result = await rejectRevisionProposal(ctx.db as unknown as RejectDb, {
				proposalId: input.id,
				userId: ctx.session.user.id,
			});

			if (!result.ok) {
				throwForResult(result);
			}

			return {
				proposalId: result.proposal.id,
				status: result.proposal.status,
			};
		}),
});
