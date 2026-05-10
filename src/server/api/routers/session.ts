import { TRPCError } from "@trpc/server";
import type { ModelMessage } from "ai";
import { z } from "zod";
import { assembleContext } from "~/server/ai/context-manager";
import { createToolRegistry } from "~/server/ai/tools/registry";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createLLMClient } from "~/server/llm/client";

export const sessionRouter = createTRPCRouter({
	create: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				chapterId: z.string().optional(),
				title: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const project = await ctx.db.project.findFirst({
				where: { id: input.projectId, userId: ctx.session.user.id },
			});
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return ctx.db.aISession.create({
				data: {
					projectId: input.projectId,
					chapterId: input.chapterId,
					title: input.title,
					messages: "[]",
				},
			});
		}),

	list: protectedProcedure
		.input(z.object({ projectId: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.aISession.findMany({
				where: {
					projectId: input.projectId,
					project: { userId: ctx.session.user.id },
				},
				orderBy: { updatedAt: "desc" },
				select: {
					id: true,
					title: true,
					chapterId: true,
					updatedAt: true,
					createdAt: true,
				},
			});
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const session = await ctx.db.aISession.findFirst({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});

			if (!session) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return {
				...session,
				messages: (() => {
					try {
						return JSON.parse(session.messages) as {
							role: string;
							content: string;
						}[];
					} catch {
						return [];
					}
				})(),
			};
		}),

	send: protectedProcedure
		.input(z.object({ id: z.string(), message: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const session = await ctx.db.aISession.findFirst({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});

			if (!session) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			// Parse existing messages and append the user message (for LLM context)
			let messages: { role: string; content: string }[];
			try {
				messages = JSON.parse(session.messages);
			} catch {
				messages = [];
			}
			messages.push({ role: "user", content: input.message });

			try {
				// Build context — either full project context (L0+L1) or a minimal system prompt
				let contextMessages: ModelMessage[];
				if (session.chapterId) {
					contextMessages = await assembleContext({
						db: ctx.db,
						projectId: session.projectId,
						currentChapterId: session.chapterId,
					});
				} else {
					contextMessages = [
						{
							role: "system",
							content:
								"You are an AI writing assistant for a novel project. " +
								"Your role is to help the author write, edit, and plan their novel. " +
								"You can read chapters, search the text, check consistency, " +
								"update outlines, generate summaries, and write text. " +
								"Always be constructive and specific in your feedback. " +
								"When suggesting text, match the author's style and tone.",
						},
					];
				}

				const llmClient = createLLMClient({
					db: ctx.db,
					userId: ctx.session.user.id,
				});

				const tools = createToolRegistry({
					db: ctx.db,
					projectId: session.projectId,
					llmClient,
				});

				const allMessages = [...contextMessages, ...messages] as ModelMessage[];

				const result = await llmClient.generate({
					task: "chat",
					messages: allMessages,
					tools,
					maxTokens: 4096,
					temperature: 0.7,
				});

				// Build the assistant message from the AI response
				const assistantMessage: Record<string, unknown> = {
					role: "assistant",
					content: result.text || "",
				};
				if (result.toolCalls?.length) {
					assistantMessage.toolCalls = result.toolCalls;
				}
				if (result.toolResults?.length) {
					assistantMessage.toolResults = result.toolResults;
				}

				// Atomically merge messages to prevent concurrent send race conditions
				const updated = await ctx.db.$transaction(async (tx) => {
					const current = await tx.aISession.findFirst({
						where: {
							id: input.id,
							project: { userId: ctx.session.user.id },
						},
					});
					if (!current) throw new TRPCError({ code: "NOT_FOUND" });

					let currentMessages: { role: string; content: string }[];
					try {
						currentMessages = JSON.parse(current.messages);
					} catch {
						currentMessages = [];
					}
					currentMessages.push({
						role: "user",
						content: input.message,
					});
					currentMessages.push(
						assistantMessage as { role: string; content: string },
					);

					const data: { messages: string; title?: string } = {
						messages: JSON.stringify(currentMessages),
					};
					if (!current.title) {
						data.title = input.message.slice(0, 100);
					}

					return tx.aISession.update({
						where: { id: input.id },
						data,
					});
				});

				return {
					message: {
						role: "assistant",
						content: result.text || "",
					},
					session: {
						id: updated.id,
						title: updated.title,
						updatedAt: updated.updatedAt,
					},
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("[session.send] AI generation failed:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "AI generation failed. Please try again.",
				});
			}
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.aISession.delete({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});
		}),
});
