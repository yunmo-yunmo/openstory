import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");

function modelBlock(name: string): string {
	const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
	assert.ok(match, `Expected model ${name} to exist`);
	return match[1] ?? "";
}

test("LLMConfig stores encrypted in-app model service configuration", () => {
	const llmConfig = modelBlock("LLMConfig");

	for (const field of [
		"name",
		"providerType",
		"apiKeyEncrypted",
		"baseUrl",
		"model",
		"availableModels",
		"modelsUpdatedAt",
		"isActive",
		"createdAt",
		"updatedAt",
	]) {
		assert.match(llmConfig, new RegExp(`\\b${field}\\b`));
	}

	assert.doesNotMatch(llmConfig, /\bapiKey\s+String/);
	assert.match(llmConfig, /@@index\(\[userId, isActive\]\)/);
});
