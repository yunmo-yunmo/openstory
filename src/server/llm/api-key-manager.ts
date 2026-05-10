import "server-only";
import type { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../services/encryption";
import { LLMConfigError } from "./errors";
import type { ProviderType, ResolvedConfig } from "./types";

const ENV_FALLBACKS = {
	anthropic: {
		apiKey: "ANTHROPIC_API_KEY",
		model: "claude-sonnet-4-20250514",
	},
	"openai-compatible": {
		apiKey: "OPENAI_API_KEY",
		baseUrl: "OPENAI_BASE_URL",
		model: "OPENAI_MODEL",
		defaultBaseUrl: "https://api.openai.com/v1",
		defaultModel: "gpt-4o",
	},
} as const;

export async function resolveApiKey(
	db: PrismaClient,
	userId: string,
	desiredProvider: ProviderType,
	desiredModel?: string,
	prefetchedConfig?: {
		providerType: string;
		apiKeyEncrypted: string;
		baseUrl: string | null;
		model: string | null;
	} | null,
): Promise<ResolvedConfig> {
	const userConfig =
		prefetchedConfig ??
		(await db.lLMConfig.findFirst({
			where: { userId, isActive: true },
		}));

	if (userConfig?.apiKeyEncrypted) {
		const encryptionKey = process.env.LLM_ENCRYPTION_KEY;
		if (!encryptionKey) {
			throw new LLMConfigError(
				"ENCRYPTION_KEY_MISSING",
				"LLM_ENCRYPTION_KEY is required to decrypt saved model API keys.",
			);
		}

		let apiKey: string;
		try {
			apiKey = decryptSecret(userConfig.apiKeyEncrypted, encryptionKey);
		} catch {
			throw new LLMConfigError(
				"API_KEY_DECRYPT_FAILED",
				"Unable to decrypt saved model API key.",
			);
		}

		const fb = ENV_FALLBACKS[userConfig.providerType as ProviderType];
		return {
			providerType: userConfig.providerType as ProviderType,
			apiKey,
			baseUrl: userConfig.baseUrl,
			model: desiredModel ?? userConfig.model ?? fb?.model ?? "",
		};
	}

	const openai = ENV_FALLBACKS["openai-compatible"];
	const fallback = ENV_FALLBACKS[desiredProvider];
	const envKey = process.env[fallback.apiKey];
	if (envKey) {
		const baseUrl =
			desiredProvider === "openai-compatible"
				? (process.env.OPENAI_BASE_URL ?? openai.defaultBaseUrl)
				: undefined;
		const model =
			desiredModel ??
			(desiredProvider === "openai-compatible"
				? (process.env.OPENAI_MODEL ?? openai.defaultModel)
				: fallback.model);
		return {
			providerType: desiredProvider,
			apiKey: envKey,
			baseUrl,
			model,
		};
	}

	throw new LLMConfigError(
		"NO_MODEL_CONFIG",
		`No API key found for provider: ${desiredProvider}`,
	);
}
