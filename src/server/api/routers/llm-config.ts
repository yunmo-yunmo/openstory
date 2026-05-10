import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { fetchModelsForConfig } from "../../llm/model-service";
import { getProviderFactory } from "../../llm/provider-registry";
import { decryptSecret, encryptSecret } from "../../services/encryption";
import type { createTRPCRouter, protectedProcedure } from "../trpc";

const providerTypeSchema = z.enum(["anthropic", "openai-compatible"]);

type LLMConfigForSerialization = {
	id: string;
	name: string;
	providerType: string;
	apiKeyEncrypted: string;
	baseUrl: string | null;
	model: string | null;
	availableModels: string | null;
	modelsUpdatedAt: Date | null;
	isActive: boolean;
};

function parseAvailableModels(availableModels: string | null): string[] {
	if (!availableModels) {
		return [];
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(availableModels);
	} catch {
		return [];
	}

	if (!Array.isArray(parsed)) {
		return [];
	}

	return parsed.filter((model): model is string => typeof model === "string");
}

export function serializeLLMConfig(config: LLMConfigForSerialization) {
	return {
		id: config.id,
		name: config.name,
		providerType: config.providerType,
		baseUrl: config.baseUrl,
		model: config.model,
		availableModels: parseAvailableModels(config.availableModels),
		modelsUpdatedAt: config.modelsUpdatedAt,
		isActive: config.isActive,
		hasApiKey: config.apiKeyEncrypted.length > 0,
	};
}

function requireEncryptionKey(env: LLMConfigEnv) {
	if (!env.LLM_ENCRYPTION_KEY) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "LLM_ENCRYPTION_KEY is required to save model API keys.",
		});
	}

	return env.LLM_ENCRYPTION_KEY;
}

type RouterBuilder = typeof createTRPCRouter;
type ProtectedProcedure = typeof protectedProcedure;
type LLMConfigEnv = {
	LLM_ENCRYPTION_KEY?: string;
	ANTHROPIC_API_KEY?: string;
	OPENAI_API_KEY?: string;
};

export function getLLMConfigStatus({
	hasActiveConfig,
	env,
}: {
	hasActiveConfig: boolean;
	env: LLMConfigEnv;
}) {
	if (hasActiveConfig) {
		return { hasUsableConfig: true, source: "db" as const };
	}

	if (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) {
		return { hasUsableConfig: true, source: "env" as const };
	}

	return { hasUsableConfig: false, source: "none" as const };
}

const createInputSchema = z.object({
	name: z.string().min(1),
	providerType: providerTypeSchema,
	apiKey: z.string().min(1),
	baseUrl: z.string().url().optional(),
	model: z.string().min(1).optional(),
	isActive: z.boolean().default(false),
});

const updateInputSchema = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	providerType: providerTypeSchema.optional(),
	apiKey: z.string().min(1).optional(),
	baseUrl: z.string().url().nullable().optional(),
	model: z.string().min(1).nullable().optional(),
});

export function createLLMConfigRouter({
	createTRPCRouter,
	env,
	protectedProcedure,
}: {
	createTRPCRouter: RouterBuilder;
	env: LLMConfigEnv;
	protectedProcedure: ProtectedProcedure;
}) {
	return createTRPCRouter({
		list: protectedProcedure.query(async ({ ctx }) => {
			const configs = await ctx.db.lLMConfig.findMany({
				where: { userId: ctx.session.user.id },
				orderBy: { updatedAt: "desc" },
			});

			return configs.map(serializeLLMConfig);
		}),

		create: protectedProcedure
			.input(createInputSchema)
			.mutation(async ({ ctx, input }) => {
				const apiKeyEncrypted = encryptSecret(
					input.apiKey,
					requireEncryptionKey(env),
				);

				if (!input.isActive) {
					const config = await ctx.db.lLMConfig.create({
						data: {
							userId: ctx.session.user.id,
							name: input.name,
							providerType: input.providerType,
							apiKeyEncrypted,
							baseUrl: input.baseUrl,
							model: input.model,
							isActive: false,
						},
					});

					return serializeLLMConfig(config);
				}

				const [, config] = await ctx.db.$transaction([
					ctx.db.lLMConfig.updateMany({
						where: { userId: ctx.session.user.id },
						data: { isActive: false },
					}),
					ctx.db.lLMConfig.create({
						data: {
							userId: ctx.session.user.id,
							name: input.name,
							providerType: input.providerType,
							apiKeyEncrypted,
							baseUrl: input.baseUrl,
							model: input.model,
							isActive: true,
						},
					}),
				]);

				return serializeLLMConfig(config);
			}),

		update: protectedProcedure
			.input(updateInputSchema)
			.mutation(async ({ ctx, input }) => {
				const existing = await ctx.db.lLMConfig.findFirst({
					where: { id: input.id, userId: ctx.session.user.id },
				});

				if (!existing) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Model service configuration not found.",
					});
				}

				const config = await ctx.db.lLMConfig.update({
					where: { id: existing.id },
					data: {
						...(input.name !== undefined ? { name: input.name } : {}),
						...(input.providerType !== undefined
							? { providerType: input.providerType }
							: {}),
						...(input.apiKey !== undefined
							? {
									apiKeyEncrypted: encryptSecret(
										input.apiKey,
										requireEncryptionKey(env),
									),
								}
							: {}),
						...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
						...(input.model !== undefined ? { model: input.model } : {}),
					},
				});

				return serializeLLMConfig(config);
			}),

		delete: protectedProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const existing = await ctx.db.lLMConfig.findFirst({
					where: { id: input.id, userId: ctx.session.user.id },
				});

				if (!existing) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Model service configuration not found.",
					});
				}

				await ctx.db.lLMConfig.delete({ where: { id: existing.id } });

				return { success: true };
			}),

		setActive: protectedProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const existing = await ctx.db.lLMConfig.findFirst({
					where: { id: input.id, userId: ctx.session.user.id },
				});

				if (!existing) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Model service configuration not found.",
					});
				}

				const [, config] = await ctx.db.$transaction([
					ctx.db.lLMConfig.updateMany({
						where: { userId: ctx.session.user.id },
						data: { isActive: false },
					}),
					ctx.db.lLMConfig.update({
						where: { id: existing.id },
						data: { isActive: true },
					}),
				]);

				return serializeLLMConfig(config);
			}),

		status: protectedProcedure.query(async ({ ctx }) => {
			const active = await ctx.db.lLMConfig.findFirst({
				where: { userId: ctx.session.user.id, isActive: true },
				select: { id: true },
			});

			return getLLMConfigStatus({ hasActiveConfig: Boolean(active), env });
		}),

		fetchModels: protectedProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const config = await ctx.db.lLMConfig.findFirst({
					where: { id: input.id, userId: ctx.session.user.id },
				});
				if (!config) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Model service configuration not found.",
					});
				}

				const encryptionKey = requireEncryptionKey(env);
				const apiKey = decryptSecret(config.apiKeyEncrypted, encryptionKey);

				const models = await fetchModelsForConfig({
					providerType: config.providerType as
						| "anthropic"
						| "openai-compatible",
					apiKey,
					baseUrl: config.baseUrl,
				});

				const updated = await ctx.db.lLMConfig.update({
					where: { id: config.id },
					data: {
						availableModels: JSON.stringify(models),
						modelsUpdatedAt: new Date(),
					},
				});

				return serializeLLMConfig(updated);
			}),

		testConnection: protectedProcedure
			.input(
				z.object({
					id: z.string(),
					model: z.string().optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const config = await ctx.db.lLMConfig.findFirst({
					where: { id: input.id, userId: ctx.session.user.id },
				});
				if (!config) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Model service configuration not found.",
					});
				}

				const encryptionKey = requireEncryptionKey(env);
				const apiKey = decryptSecret(config.apiKeyEncrypted, encryptionKey);

				const defaultModel =
					config.providerType === "anthropic"
						? "claude-sonnet-4-20250514"
						: "gpt-4o";
				const modelId = input.model ?? config.model ?? defaultModel;

				try {
					const factory = getProviderFactory(config.providerType);
					const model = factory({
						apiKey,
						baseUrl: config.baseUrl,
					})(modelId);

					const { generateText } = await import("ai");
					await generateText({
						model,
						prompt: "Reply with only: connected",
						maxOutputTokens: 20,
					});

					return { success: true };
				} catch (err) {
					const message =
						err instanceof Error ? err.message : "Connection test failed";
					throw new TRPCError({
						code: "BAD_REQUEST",
						message,
					});
				}
			}),
	});
}
