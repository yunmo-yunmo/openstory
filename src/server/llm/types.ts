import type { LanguageModel } from "ai";

export type ProviderType = "anthropic" | "openai-compatible";

export type LLMProviderFactory = (options: {
	apiKey: string;
	baseUrl?: string | null;
}) => (modelId: string) => LanguageModel;

export type TaskType =
	| "chat"
	| "writing"
	| "summary"
	| "consistency"
	| "search";

export interface ResolvedConfig {
	providerType: ProviderType;
	apiKey: string;
	baseUrl?: string | null;
	model: string;
}
