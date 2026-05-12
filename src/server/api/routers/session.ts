import { TRPCError } from "@trpc/server";
import type { ModelMessage } from "ai";
import { z } from "zod";
import { assembleContext } from "~/server/ai/context-manager";
import { createToolRegistry } from "~/server/ai/tools/registry";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createLLMClient } from "~/server/llm/client";
import {
	hashChapterContent,
	hasRevisionEditIntent,
	revisionProposalDraftSchema,
	validateRevisionProposalDraft,
} from "~/server/services/revision-proposal";
import { tiptapToPlainText } from "~/server/services/tiptap-converter";

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
		.input(
			z.object({
				id: z.string(),
				message: z.string().min(1),
				selectionContext: z
					.object({
						selectedText: z.string(),
						beforeContext: z.string(),
						afterContext: z.string(),
						operation: z.enum([
							"rewrite",
							"polish",
							"expand",
							"shorten",
							"continue",
						]),
					})
					.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const session = await ctx.db.aISession.findFirst({
				where: { id: input.id, project: { userId: ctx.session.user.id } },
			});

			if (!session) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			// Parse existing messages (user message constructed separately per path)
			let messages: { role: string; content: string }[];
			try {
				messages = JSON.parse(session.messages);
			} catch {
				messages = [];
			}
			let userContent = input.message;
			if (input.selectionContext) {
				const sel = input.selectionContext;
				const opLabels: Record<string, string> = {
					rewrite: "改写",
					polish: "润色",
					expand: "扩写",
					shorten: "缩写",
					continue: "续写",
				};
				userContent = `${opLabels[sel.operation]}${sel.operation === "continue" ? "" : "选中的文字"}：${sel.selectedText}`;
			}
			const userMessage = { role: "user" as const, content: userContent };

			// --- Revision proposal path ---
			// Attempt structured proposal generation when the user message contains
			// edit-intent keywords and the session is bound to a chapter.
			if (
				(hasRevisionEditIntent(input.message) || input.selectionContext) &&
				session.chapterId
			) {
				const chapter = await ctx.db.chapter.findFirst({
					where: {
						id: session.chapterId,
						projectId: session.projectId,
					},
				});

				if (chapter) {
					const baseContentHash = hashChapterContent(chapter.content);
					const chapterPlainText = tiptapToPlainText(chapter.content);

					// Choose prompt language based on whether the user message contains CJK
					const isChinese = /\p{Script=Han}/u.test(input.message);

					const systemPrompt = isChinese
						? `你是一个小说写作修订助手。用户希望对章节进行修改。请根据用户的要求生成一个修订提案。

当前章节内容：
---
${chapterPlainText}
---

规则：
- 如果用户要求续写、扩写内容，使用 "append" 操作，只需提供 instruction 和 replacementText
- 如果用户要求改写、润色、重写特定段落，使用 "replace" 操作，需要提供 targetHint（简述修改目标）、originalText（从章节中复制的原文片段，必须完全匹配）、replacementText（替换后的文本）
- originalText 必须是章节原文的精确子串，不可自行改写或省略
- 替换目标至少包含 20 个中文字符或 80 个非空白英文字符
- replacementText 应保持与原文风格一致`
						: `You are a novel revision assistant. The user wants to modify a chapter. Generate a revision proposal based on their request.

Current chapter content:
---
${chapterPlainText}
---

Rules:
- For continuation/expansion requests, use "append" operation with instruction and replacementText
- For rewriting/polishing specific sections, use "replace" operation with targetHint, originalText (exact substring from chapter), and replacementText
- originalText must be an exact substring from the chapter text
- Replacement target must contain at least 80 non-whitespace characters for English or 20 CJK characters
- replacementText should match the author's style`;

					const revisionMessages: ModelMessage[] = [
						{ role: "system", content: systemPrompt },
						...(messages as ModelMessage[]),
						userMessage,
					];

					try {
						const llmClient = createLLMClient({
							db: ctx.db,
							userId: ctx.session.user.id,
						});

						const { object: draft } = await llmClient.generateObject({
							task: "revision",
							messages: revisionMessages,
							schema: revisionProposalDraftSchema,
							temperature: 0.7,
						});

						// Re-check chapter hash to detect concurrent edits
						const chapterNow = await ctx.db.chapter.findFirst({
							where: {
								id: session.chapterId,
								projectId: session.projectId,
							},
						});
						if (
							!chapterNow ||
							hashChapterContent(chapterNow.content) !== baseContentHash
						) {
							// Chapter changed concurrently — fall through to normal chat
						} else {
							const validation = validateRevisionProposalDraft(
								draft,
								tiptapToPlainText(chapterNow.content),
							);

							if (validation.ok) {
								const proposal = await ctx.db.chapterRevisionProposal.create({
									data: {
										projectId: session.projectId,
										chapterId: session.chapterId,
										sessionId: session.id,
										status: "pending",
										operation: draft.operation,
										instruction: draft.instruction,
										targetHint:
											draft.operation === "replace" ? draft.targetHint : null,
										originalText:
											draft.operation === "replace" ? draft.originalText : null,
										replacementText: draft.replacementText,
										baseContentHash,
									},
								});

								const proposalSummary =
									draft.operation === "append"
										? `已为您生成追加提案：${draft.instruction}`
										: `已为您生成替换提案：${draft.targetHint}`;

								const assistantMessage: Record<string, unknown> = {
									role: "assistant",
									content: proposalSummary,
									proposalId: proposal.id,
								};

								// Atomically merge messages
								const updated = await ctx.db.$transaction(async (tx) => {
									const current = await tx.aISession.findFirst({
										where: {
											id: input.id,
											project: {
												userId: ctx.session.user.id,
											},
										},
									});
									if (!current)
										throw new TRPCError({
											code: "NOT_FOUND",
										});

									let currentMessages: {
										role: string;
										content: string;
									}[];
									try {
										currentMessages = JSON.parse(current.messages);
									} catch {
										currentMessages = [];
									}
									currentMessages.push(
										userMessage as {
											role: string;
											content: string;
										},
									);
									currentMessages.push(
										assistantMessage as {
											role: string;
											content: string;
										},
									);

									const data: {
										messages: string;
										title?: string;
									} = {
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
										role: "assistant" as const,
										content: proposalSummary,
										proposalId: proposal.id,
									},
									session: {
										id: updated.id,
										title: updated.title,
										updatedAt: updated.updatedAt,
									},
								};
							}
							// Draft validation failed — fall through to normal chat
						}
					} catch {
						// generateObject failed (structured output error, etc.)
						// Fall through to normal chat
					}
				}
			}
			// --- End revision proposal path ---

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

				const allMessages = [
					...contextMessages,
					...messages,
					userMessage,
				] as ModelMessage[];

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
					currentMessages.push(
						userMessage as { role: string; content: string },
					);
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
