import "server-only";
import type { PrismaClient } from "@prisma/client";
import { resolveApiKey } from "./api-key-manager";
import type { ProviderType, ResolvedConfig, TaskType } from "./types";

const DEFAULT_TASK_MODELS: Record<
	TaskType,
	{ providerType: ProviderType; model: string }
> = {
	chat: { providerType: "anthropic", model: "claude-sonnet-4-20250514" },
	writing: { providerType: "anthropic", model: "claude-sonnet-4-20250514" },
	summary: { providerType: "anthropic", model: "claude-haiku-4-20250514" },
	consistency: { providerType: "anthropic", model: "claude-sonnet-4-20250514" },
	search: { providerType: "anthropic", model: "claude-haiku-4-20250514" },
};

/**
 * Detect which provider has env vars available, preferring openai-compatible
 * when OPENAI_API_KEY is set (so users who only configure env vars for a
 * non-Anthropic provider still get routed correctly).
 */
function detectEnvProvider(): ProviderType {
	if (process.env.OPENAI_API_KEY) return "openai-compatible";
	return "anthropic";
}

export async function routeModel(
	db: PrismaClient,
	userId: string,
	task: TaskType,
): Promise<ResolvedConfig> {
	// Check if the user has an active DB config — if so, use its provider and model.
	const activeConfig = await db.lLMConfig.findFirst({
		where: { userId, isActive: true },
	});

	if (activeConfig) {
		return resolveApiKey(
			db,
			userId,
			activeConfig.providerType as ProviderType,
			activeConfig.model ?? undefined,
			activeConfig,
		);
	}

	// No DB config — fall back to env vars. Use the default task model mapping
	// but pick the provider based on which env vars are actually available.
	// Only use the task-specific model when the env provider matches the
	// default mapping's provider (both "anthropic"). Otherwise pass undefined
	// so resolveApiKey applies its own defaults (OPENAI_MODEL / gpt-4o).
	const envProvider = detectEnvProvider();
	const mapping = DEFAULT_TASK_MODELS[task];
	const model =
		envProvider === mapping.providerType ? mapping.model : undefined;
	return resolveApiKey(db, userId, envProvider, model, undefined);
}
