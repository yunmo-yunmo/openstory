import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { runBackgroundAgents } from "~/server/ai/agents";
import { createSnapshot } from "~/server/ai/tools/data-access";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { formatChapterExport } from "~/server/services/chapter-export";
import { prepareImportData } from "~/server/services/chapter-import";
import { splitChapters } from "~/server/services/chapter-splitter";
import {
	countWords,
	tiptapToPlainText,
} from "~/server/services/tiptap-converter";

export const chapterRouter = createTRPCRouter({
	listByProject: protectedProcedure
		.input(z.object({ projectId: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.chapter.findMany({
				where: {
					projectId: input.projectId,
					project: { userId: ctx.session.user.id },
				},
				orderBy: { order: "asc" },
				select: {
					id: true,
					title: true,
					order: true,
					wordCount: true,
					summary: true,
					status: true,
					createdAt: true,
					updatedAt: true,
				},
			});
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.chapter.findFirst({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
				include: {
					snapshots: { orderBy: { version: "desc" }, take: 5 },
				},
			});
		}),

	create: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				title: z.string().min(1),
				content: z.string().optional(),
				order: z.number(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const project = await ctx.db.project.findFirst({
				where: { id: input.projectId, userId: ctx.session.user.id },
			});
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
			const wordCount = input.content
				? countWords(tiptapToPlainText(input.content))
				: 0;
			return ctx.db.chapter.create({
				data: {
					projectId: input.projectId,
					title: input.title,
					content: input.content ?? "",
					order: input.order,
					wordCount,
				},
			});
		}),

	save: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				content: z.string(),
				title: z.string().min(1).optional(),
				status: z.enum(["draft", "review", "complete"]).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const wordCount = countWords(tiptapToPlainText(input.content));

			const chapter = await ctx.db.chapter.update({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
				data: {
					content: input.content,
					wordCount,
					...(input.title ? { title: input.title } : {}),
					...(input.status ? { status: input.status } : {}),
				},
			});

			try {
				await createSnapshot(ctx.db, input.id, chapter.projectId);
			} catch (err) {
				console.error("[chapter.save] Snapshot creation failed:", err);
			}

			runBackgroundAgents({
				db: ctx.db,
				userId: ctx.session.user.id,
				projectId: chapter.projectId,
				chapterId: chapter.id,
				expectedChapterUpdatedAt: chapter.updatedAt,
			}).catch((err) => {
				console.error("[chapter.save] Background agents failed:", err);
			});

			return ctx.db.chapter.findUnique({
				where: { id: input.id },
				include: {
					snapshots: { orderBy: { version: "desc" }, take: 1 },
				},
			});
		}),

	updateOrder: protectedProcedure
		.input(
			z.object({
				chapters: z.array(z.object({ id: z.string(), order: z.number() })),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await ctx.db.$transaction(
				input.chapters.map((ch) =>
					ctx.db.chapter.updateMany({
						where: { id: ch.id, project: { userId: ctx.session.user.id } },
						data: { order: ch.order },
					}),
				),
			);
			return { success: true };
		}),

	importChapters: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				text: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const project = await ctx.db.project.findFirst({
				where: { id: input.projectId, userId: ctx.session.user.id },
			});
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const splits = splitChapters(input.text);
			if (splits.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No chapters detected in the imported text.",
				});
			}

			const existingCount = await ctx.db.chapter.count({
				where: { projectId: input.projectId },
			});

			const chapters = prepareImportData(splits, existingCount);

			const created = await ctx.db.$transaction(
				chapters.map((ch) =>
					ctx.db.chapter.create({
						data: {
							projectId: input.projectId,
							title: ch.title,
							content: ch.content,
							order: ch.order,
							wordCount: ch.wordCount,
						},
					}),
				),
			);

			return created;
		}),

	exportChapters: protectedProcedure
		.input(z.object({ projectId: z.string() }))
		.query(async ({ ctx, input }) => {
			const chapters = await ctx.db.chapter.findMany({
				where: {
					projectId: input.projectId,
					project: { userId: ctx.session.user.id },
				},
				orderBy: { order: "asc" },
				select: { title: true, content: true },
			});

			if (chapters.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No chapters to export.",
				});
			}

			return formatChapterExport(chapters);
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.chapter.delete({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});
		}),
});
