import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { plainTextToTipTap } from "~/server/services/tiptap-converter";
import {
	buildWorldNoteUpdateData,
	serializeWorldNoteTags,
} from "./world-note-helpers";

const worldNoteCategorySchema = z.enum([
	"general",
	"location",
	"history",
	"magic",
	"culture",
	"other",
]);

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
	if (!project) throw new TRPCError({ code: "NOT_FOUND" });
	return project;
}

export const worldNoteRouter = createTRPCRouter({
	listByProject: protectedProcedure
		.input(z.object({ projectId: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.worldNote.findMany({
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
				content: z.string().default(""),
				category: worldNoteCategorySchema.default("general"),
				tags: z.array(z.string()).optional(),
				order: z.number().int().nonnegative().default(0),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			await assertProjectOwned(ctx.db, input.projectId, ctx.session.user.id);
			return ctx.db.worldNote.create({
				data: {
					projectId: input.projectId,
					title: input.title,
					content: plainTextToTipTap(input.content),
					category: input.category,
					tags: input.tags ? serializeWorldNoteTags(input.tags) : null,
					order: input.order,
				},
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				title: z.string().min(1).optional(),
				content: z.string().optional(),
				category: worldNoteCategorySchema.optional(),
				tags: z.array(z.string()).nullable().optional(),
				order: z.number().int().nonnegative().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const note = await ctx.db.worldNote.findFirst({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});
			if (!note) throw new TRPCError({ code: "NOT_FOUND" });

			const data = buildWorldNoteUpdateData({
				title: input.title,
				content:
					input.content === undefined
						? undefined
						: plainTextToTipTap(input.content),
				category: input.category,
				tags: input.tags,
				order: input.order,
			});
			if (Object.keys(data).length === 0) return note;

			const result = await ctx.db.worldNote.updateMany({
				where: { id: input.id, projectId: note.projectId },
				data,
			});
			if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });

			const updated = await ctx.db.worldNote.findFirst({
				where: { id: input.id, projectId: note.projectId },
			});
			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const note = await ctx.db.worldNote.findFirst({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});
			if (!note) throw new TRPCError({ code: "NOT_FOUND" });

			const result = await ctx.db.worldNote.deleteMany({
				where: { id: input.id, projectId: note.projectId },
			});
			if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
			return note;
		}),
});
