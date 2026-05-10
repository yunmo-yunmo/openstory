import assert from "node:assert/strict";
import test from "node:test";
import { getLLMConfigStatus, serializeLLMConfig } from "./llm-config";

test("serializeLLMConfig never returns encrypted or plaintext API keys", () => {
	const output = serializeLLMConfig({
		id: "cfg-1",
		name: "DeepSeek",
		providerType: "openai-compatible",
		apiKeyEncrypted: "v1:encrypted",
		baseUrl: "https://api.deepseek.com/v1",
		model: "deepseek-chat",
		availableModels: JSON.stringify(["deepseek-chat"]),
		modelsUpdatedAt: null,
		isActive: true,
	});

	assert.equal(output.hasApiKey, true);
	assert.equal("apiKeyEncrypted" in output, false);
	assert.equal("apiKey" in output, false);
	assert.deepEqual(output.availableModels, ["deepseek-chat"]);
});

test("serializeLLMConfig returns an empty model list for malformed availableModels JSON", () => {
	const output = serializeLLMConfig({
		id: "cfg-1",
		name: "DeepSeek",
		providerType: "openai-compatible",
		apiKeyEncrypted: "v1:encrypted",
		baseUrl: "https://api.deepseek.com/v1",
		model: "deepseek-chat",
		availableModels: "{not-json",
		modelsUpdatedAt: null,
		isActive: true,
	});

	assert.deepEqual(output.availableModels, []);
});

test("getLLMConfigStatus reports usable config when either ANTHROPIC_API_KEY or OPENAI_API_KEY is set", () => {
	assert.deepEqual(
		getLLMConfigStatus({
			hasActiveConfig: false,
			env: { OPENAI_API_KEY: "sk-openai" },
		}),
		{ hasUsableConfig: true, source: "env" },
	);
	assert.deepEqual(
		getLLMConfigStatus({
			hasActiveConfig: false,
			env: { ANTHROPIC_API_KEY: "sk-anthropic" },
		}),
		{ hasUsableConfig: true, source: "env" },
	);
});
