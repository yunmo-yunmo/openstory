import assert from "node:assert/strict";
import test from "node:test";
import { parseOpenAICompatibleModels } from "./model-service";

test("parseOpenAICompatibleModels extracts ids from OpenAI model response", () => {
	const models = parseOpenAICompatibleModels({
		data: [{ id: "gpt-4o" }, { id: "deepseek-chat" }],
	});

	assert.deepEqual(models, ["gpt-4o", "deepseek-chat"]);
});

test("parseOpenAICompatibleModels rejects malformed responses", () => {
	assert.throws(
		() => parseOpenAICompatibleModels({ data: [{ name: "bad" }] }),
		/No model ids/,
	);
});
