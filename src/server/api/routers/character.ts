import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { buildCharacterUpdateData } from "./character-helpers";

export const characterRouter = createTRPCRouter({
	listByProject: protectedProcedure
		.input(z.object({ projectId: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.character.findMany({
				where: {
					projectId: input.projectId,
					project: { userId: ctx.session.user.id },
				},
				orderBy: { createdAt: "asc" },
			});
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.character.findFirst({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});
		}),

	create: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				name: z.string().min(1),
				description: z.string().optional(),
				traits: z.string().optional(),
				relationships: z.string().optional(),
				notes: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const project = await ctx.db.project.findFirst({
				where: { id: input.projectId, userId: ctx.session.user.id },
			});
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
			return ctx.db.character.create({
				data: input,
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				description: z.string().nullable().optional(),
				traits: z.string().nullable().optional(),
				relationships: z.string().nullable().optional(),
				notes: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			return ctx.db.character.update({
				where: { id, project: { userId: ctx.session.user.id } },
				data: buildCharacterUpdateData(data),
			});
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.character.delete({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});
		}),
});
