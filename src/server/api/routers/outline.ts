import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
	buildOutlineUpdateData,
	wouldCreateOutlineCycle,
	type OutlineStatus,
} from "./outline-helpers";

const outlineStatusSchema = z.enum(["planned", "writing", "done"]);

const outlineUpdateSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	order: z.number().int().nonnegative().optional(),
	parentId: z.string().nullable().optional(),
	chapterId: z.string().nullable().optional(),
	status: outlineStatusSchema.optional(),
});

async function assertProjectOwned(
	db: {
		project: {
			findFirst: (args: {
				where: { id: string; userId: string };
				select: { id: true };
			}) => Promise<{ id: string } | null>;
		};
	},
	projectId: string,
	userId: string,
) {
	const project = await db.project.findFirst({
		where: { id: projectId, userId },
		select: { id: true },
	});

	if (!project) {
		throw new TRPCError({ code: "NOT_FOUND" });
	}

	return project;
}

export const outlineRouter = createTRPCRouter({
	listByProject: protectedProcedure
		.input(z.object({ projectId: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.outline.findMany({
				where: {
					projectId: input.projectId,
					project: { userId: ctx.session.user.id },
				},
				orderBy: [{ order: "asc" }, { title: "asc" }],
			});
		}),

	create: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				title: z.string().min(1),
				description: z.string().nullable().optional(),
				order: z.number().int().nonnegative(),
				parentId: z.string().nullable().optional(),
				chapterId: z.string().nullable().optional(),
				status: outlineStatusSchema.default("planned"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertProjectOwned(ctx.db, input.projectId, ctx.session.user.id);

			if (input.parentId) {
				const parent = await ctx.db.outline.findFirst({
					where: { id: input.parentId, projectId: input.projectId },
					select: { id: true },
				});
				if (!parent) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
			}

			if (input.chapterId) {
				const chapter = await ctx.db.chapter.findFirst({
					where: { id: input.chapterId, projectId: input.projectId },
					select: { id: true },
				});
				if (!chapter) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
			}

			return ctx.db.outline.create({
				data: {
					projectId: input.projectId,
					title: input.title,
					description: input.description,
					order: input.order,
					parentId: input.parentId,
					chapterId: input.chapterId,
					status: input.status,
				},
			});
		}),

	update: protectedProcedure
		.input(z.object({ id: z.string() }).merge(outlineUpdateSchema))
		.mutation(async ({ ctx, input }) => {
			const outline = await ctx.db.outline.findFirst({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});
			if (!outline) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			if (input.parentId === input.id) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "An outline cannot be its own parent.",
				});
			}

			if (input.parentId) {
				const parent = await ctx.db.outline.findFirst({
					where: { id: input.parentId, projectId: outline.projectId },
					select: { id: true },
				});
				if (!parent) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}

				const outlines = await ctx.db.outline.findMany({
					where: { projectId: outline.projectId },
					select: { id: true, parentId: true },
				});
				if (wouldCreateOutlineCycle(outlines, input.id, input.parentId)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Outline parent would create a cycle.",
					});
				}
			}

			if (input.chapterId) {
				const chapter = await ctx.db.chapter.findFirst({
					where: { id: input.chapterId, projectId: outline.projectId },
					select: { id: true },
				});
				if (!chapter) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
			}

			const updateData = buildOutlineUpdateData({
				title: input.title,
				description: input.description,
				order: input.order,
				parentId: input.parentId,
				chapterId: input.chapterId,
				status: input.status as OutlineStatus | undefined,
			});

			if (Object.keys(updateData).length === 0) {
				return outline;
			}

			const result = await ctx.db.outline.updateMany({
				where: { id: input.id, projectId: outline.projectId },
				data: updateData,
			});
			if (result.count === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const updated = await ctx.db.outline.findFirst({
				where: { id: input.id, projectId: outline.projectId },
			});
			if (!updated) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return updated;
		}),

	updateOrder: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				outlines: z.array(
					z.object({
						id: z.string(),
						order: z.number().int().nonnegative(),
						parentId: z.string().nullable().optional(),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertProjectOwned(ctx.db, input.projectId, ctx.session.user.id);

			const existingOutlines = await ctx.db.outline.findMany({
				where: { projectId: input.projectId },
				select: { id: true, parentId: true },
			});
			const existingIds = new Set(existingOutlines.map((outline) => outline.id));

			for (const outline of input.outlines) {
				if (!existingIds.has(outline.id)) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
				if (outline.parentId === outline.id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "An outline cannot be its own parent.",
					});
				}
				if (outline.parentId && !existingIds.has(outline.parentId)) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
			}

			const proposedParents = new Map(
				existingOutlines.map((outline) => [outline.id, outline.parentId]),
			);
			for (const outline of input.outlines) {
				if (outline.parentId !== undefined) {
					proposedParents.set(outline.id, outline.parentId);
				}
			}
			const proposedOutlines = existingOutlines.map((outline) => ({
				id: outline.id,
				parentId: proposedParents.get(outline.id) ?? null,
			}));

			for (const outline of input.outlines) {
				const parentId = proposedParents.get(outline.id) ?? null;
				if (wouldCreateOutlineCycle(proposedOutlines, outline.id, parentId)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Outline parent would create a cycle.",
					});
				}
			}

			await ctx.db.$transaction(
				input.outlines.map((outline) =>
					ctx.db.outline.updateMany({
						where: { id: outline.id, projectId: input.projectId },
						data: {
							order: outline.order,
							...(outline.parentId !== undefined
								? { parentId: outline.parentId }
								: {}),
						},
					}),
				),
			);

			return { success: true };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const outline = await ctx.db.outline.findFirst({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});
			if (!outline) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const result = await ctx.db.outline.deleteMany({
				where: { id: input.id, projectId: outline.projectId },
			});
			if (result.count === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return outline;
		}),
});
