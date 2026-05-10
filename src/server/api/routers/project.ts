import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const projectRouter = createTRPCRouter({
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				description: z.string().optional(),
				genre: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return ctx.db.project.create({
				data: {
					title: input.name,
					description: input.description,
					genre: input.genre,
					user: { connect: { id: ctx.session.user.id } },
				},
			});
		}),

	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.project.findMany({
			where: { userId: ctx.session.user.id },
			orderBy: { updatedAt: "desc" },
		});
	}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.project.findFirst({
				where: { id: input.id, userId: ctx.session.user.id },
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				title: z.string().optional(),
				description: z.string().optional(),
				genre: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			return ctx.db.project.update({
				where: { id, userId: ctx.session.user.id },
				data,
			});
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.project.delete({
				where: { id: input.id, userId: ctx.session.user.id },
			});
		}),
});
