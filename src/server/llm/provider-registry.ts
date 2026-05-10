import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { LLMConfigError } from "./errors";
import type { LLMProviderFactory } from "./types";

const registry = new Map<string, LLMProviderFactory>();

export function registerProvider(
	name: string,
	factory: LLMProviderFactory,
): void {
	registry.set(name, factory);
}

export function getProviderFactory(name: string): LLMProviderFactory {
	const factory = registry.get(name);
	if (!factory)
		throw new LLMConfigError(
			"PROVIDER_UNREGISTERED",
			`Unknown LLM provider: ${name}`,
		);
	return factory;
}

// Built-in: Anthropic
registerProvider("anthropic", ({ apiKey }) => {
	const anthropic = createAnthropic({ apiKey });
	return (modelId: string) => anthropic(modelId);
});

// Built-in: OpenAI-compatible (OpenAI, DeepSeek, etc.)
registerProvider("openai-compatible", ({ apiKey, baseUrl }) => {
	const openai = createOpenAI({
		apiKey,
		baseURL: baseUrl ?? "https://api.openai.com/v1",
	});
	return (modelId: string) => openai(modelId);
});
