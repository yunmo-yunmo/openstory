import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret, maskSecret } from "./encryption";

const key = "12345678901234567890123456789012";

test("encryptSecret stores a non-plaintext value that decrypts with the same key", () => {
	const encrypted = encryptSecret("sk-test-secret", key);

	assert.notEqual(encrypted, "sk-test-secret");
	assert.equal(decryptSecret(encrypted, key), "sk-test-secret");
});

test("decryptSecret rejects a different key", () => {
	const encrypted = encryptSecret("sk-test-secret", key);

	assert.throws(
		() => decryptSecret(encrypted, "abcdefabcdefabcdefabcdefabcdef12"),
		/Unable to decrypt secret/,
	);

	// Verify cause chain is preserved
	try {
		decryptSecret(encrypted, "abcdefabcdefabcdefabcdefabcdef12");
	} catch (err) {
		assert.ok(err instanceof Error);
		assert.ok(err.cause, "error should have a cause property");
	}
});

test("encryptSecret produces different ciphertext for the same plaintext", () => {
	const firstEncrypted = encryptSecret("sk-test-secret", key);
	const secondEncrypted = encryptSecret("sk-test-secret", key);

	assert.notEqual(firstEncrypted, secondEncrypted);
	assert.equal(decryptSecret(firstEncrypted, key), "sk-test-secret");
	assert.equal(decryptSecret(secondEncrypted, key), "sk-test-secret");
});

test("encryptSecret rejects empty plaintext", () => {
	assert.throws(
		() => encryptSecret("", key),
		/Secret plaintext must not be empty/,
	);
});

test("encryptSecret rejects short encryption keys", () => {
	assert.throws(
		() => encryptSecret("sk-test-secret", "too-short"),
		/LLM_ENCRYPTION_KEY must be at least 32 characters/,
	);
});

test("decryptSecret rejects malformed payloads with extra segments", () => {
	const encrypted = encryptSecret("sk-test-secret", key);

	assert.throws(
		() => decryptSecret(`${encrypted}:extra`, key),
		/Unable to decrypt secret/,
	);
});

test("maskSecret shows only safe prefix and suffix", () => {
	assert.equal(maskSecret("sk-abcdefghijklmnopqrstuvwxyz"), "sk-a...wxyz");
});

test("maskSecret fully masks secrets shorter than twelve characters", () => {
	assert.equal(maskSecret("123456789"), "********");
});
