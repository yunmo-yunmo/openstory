import assert from "node:assert/strict";
import test from "node:test";

import { encryptSecret } from "../services/encryption";
import { resolveApiKey } from "./api-key-manager";
import { LLMConfigError } from "./errors";

const encryptionKey = "12345678901234567890123456789012";

function restoreEnvValue(name: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[name];
		return;
	}

	process.env[name] = value;
}

test("resolveApiKey decrypts active DB config before returning apiKey", async () => {
	const encrypted = encryptSecret("sk-db-secret", encryptionKey);
	const db = {
		lLMConfig: {
			findFirst: async () => ({
				providerType: "anthropic",
				apiKeyEncrypted: encrypted,
				model: "claude-test-model",
			}),
		},
	};
	const previousKey = process.env.LLM_ENCRYPTION_KEY;
	process.env.LLM_ENCRYPTION_KEY = encryptionKey;

	try {
		const resolved = await resolveApiKey(db as never, "user-1", "anthropic");

		assert.equal(resolved.apiKey, "sk-db-secret");
		assert.notEqual(resolved.apiKey, encrypted);
		assert.equal(resolved.providerType, "anthropic");
		assert.equal(resolved.model, "claude-test-model");
	} finally {
		restoreEnvValue("LLM_ENCRYPTION_KEY", previousKey);
	}
});

test("resolveApiKey throws LLMConfigError ENCRYPTION_KEY_MISSING for active DB config", async () => {
	const db = {
		lLMConfig: {
			findFirst: async () => ({
				providerType: "anthropic",
				apiKeyEncrypted: "v1:encrypted",
				model: "claude-test-model",
			}),
		},
	};
	const previousKey = process.env.LLM_ENCRYPTION_KEY;
	delete process.env.LLM_ENCRYPTION_KEY;

	try {
		await assert.rejects(
			() => resolveApiKey(db as never, "user-1", "anthropic"),
			(err) => {
				assert.ok(err instanceof LLMConfigError);
				assert.equal(err.code, "ENCRYPTION_KEY_MISSING");
				return true;
			},
		);
	} finally {
		restoreEnvValue("LLM_ENCRYPTION_KEY", previousKey);
	}
});

test("resolveApiKey throws LLMConfigError API_KEY_DECRYPT_FAILED when decrypt fails", async () => {
	const encrypted = encryptSecret("sk-db-secret", encryptionKey);
	const db = {
		lLMConfig: {
			findFirst: async () => ({
				providerType: "anthropic",
				apiKeyEncrypted: encrypted,
				model: "claude-test-model",
			}),
		},
	};
	const previousKey = process.env.LLM_ENCRYPTION_KEY;
	process.env.LLM_ENCRYPTION_KEY = "abcdefabcdefabcdefabcdefabcdef12";

	try {
		await assert.rejects(
			() => resolveApiKey(db as never, "user-1", "anthropic"),
			(err) => {
				assert.ok(err instanceof LLMConfigError);
				assert.equal(err.code, "API_KEY_DECRYPT_FAILED");
				return true;
			},
		);
	} finally {
		restoreEnvValue("LLM_ENCRYPTION_KEY", previousKey);
	}
});

test("resolveApiKey falls back to OPENAI_API_KEY env with baseUrl and model", async () => {
	const db = {
		lLMConfig: { findFirst: async () => null },
	};
	const previousApiKey = process.env.OPENAI_API_KEY;
	const previousBaseUrl = process.env.OPENAI_BASE_URL;
	const previousModel = process.env.OPENAI_MODEL;
	process.env.OPENAI_API_KEY = "sk-openai-test";
	delete process.env.OPENAI_BASE_URL;
	delete process.env.OPENAI_MODEL;

	try {
		const resolved = await resolveApiKey(
			db as never,
			"user-1",
			"openai-compatible",
		);

		assert.equal(resolved.apiKey, "sk-openai-test");
		assert.equal(resolved.providerType, "openai-compatible");
		assert.equal(resolved.baseUrl, "https://api.openai.com/v1");
		assert.equal(resolved.model, "gpt-4o");
	} finally {
		restoreEnvValue("OPENAI_API_KEY", previousApiKey);
		restoreEnvValue("OPENAI_BASE_URL", previousBaseUrl);
		restoreEnvValue("OPENAI_MODEL", previousModel);
	}
});

test("resolveApiKey uses OPENAI_BASE_URL and OPENAI_MODEL env overrides", async () => {
	const db = {
		lLMConfig: { findFirst: async () => null },
	};
	const previousApiKey = process.env.OPENAI_API_KEY;
	const previousBaseUrl = process.env.OPENAI_BASE_URL;
	const previousModel = process.env.OPENAI_MODEL;
	process.env.OPENAI_API_KEY = "sk-deepseek";
	process.env.OPENAI_BASE_URL = "https://api.deepseek.com/v1";
	process.env.OPENAI_MODEL = "deepseek-chat";

	try {
		const resolved = await resolveApiKey(
			db as never,
			"user-1",
			"openai-compatible",
		);

		assert.equal(resolved.apiKey, "sk-deepseek");
		assert.equal(resolved.baseUrl, "https://api.deepseek.com/v1");
		assert.equal(resolved.model, "deepseek-chat");
	} finally {
		restoreEnvValue("OPENAI_API_KEY", previousApiKey);
		restoreEnvValue("OPENAI_BASE_URL", previousBaseUrl);
		restoreEnvValue("OPENAI_MODEL", previousModel);
	}
});
