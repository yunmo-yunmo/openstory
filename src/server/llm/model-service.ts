import type { ProviderType } from "./types";

export const ANTHROPIC_FALLBACK_MODELS = [
	"claude-sonnet-4-20250514",
	"claude-haiku-4-20250514",
	"claude-3-5-sonnet-latest",
];

export function parseOpenAICompatibleModels(response: unknown): string[] {
	if (!response || typeof response !== "object" || !("data" in response)) {
		throw new Error("Invalid models response");
	}
	const data = (response as { data: unknown }).data;
	if (!Array.isArray(data)) throw new Error("Invalid models response");
	const ids = data
		.map((item) =>
			item && typeof item === "object" && "id" in item
				? String((item as { id: unknown }).id)
				: "",
		)
		.filter(Boolean);
	if (ids.length === 0) throw new Error("No model ids found");
	return ids;
}

export async function fetchModelsForConfig(config: {
	providerType: ProviderType;
	apiKey: string;
	baseUrl?: string | null;
}): Promise<string[]> {
	if (config.providerType === "anthropic") {
		return ANTHROPIC_FALLBACK_MODELS;
	}

	const base = config.baseUrl ?? "https://api.openai.com/v1";
	const url = `${base.replace(/\/$/, "")}/models`;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15_000);

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
			},
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch models: ${response.status} ${response.statusText}`,
			);
		}

		const json = (await response.json()) as unknown;
		return parseOpenAICompatibleModels(json);
	} catch (err) {
		if (err instanceof DOMException && err.name === "AbortError") {
			throw new Error(
				"Model list request timed out after 15 seconds. Check your base URL and network connection.",
			);
		}
		if (
			err instanceof Error &&
			err.message.startsWith("Failed to fetch models:")
		) {
			throw err;
		}
		throw new Error(
			`Failed to fetch models: ${err instanceof Error ? err.message : "Network error"}`,
		);
	} finally {
		clearTimeout(timeout);
	}
}
