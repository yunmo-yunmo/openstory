import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_VERSION = "v1";
const MIN_SECRET_LENGTH = 32;
const MIN_PARTIALLY_MASKED_LENGTH = 12;

function deriveKey(secret: string): Buffer {
	if (secret.length < MIN_SECRET_LENGTH) {
		throw new Error("LLM_ENCRYPTION_KEY must be at least 32 characters");
	}

	return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string, secret: string): string {
	if (plaintext.length === 0) {
		throw new Error("Secret plaintext must not be empty");
	}

	const iv = randomBytes(IV_LENGTH_BYTES);
	const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return [
		KEY_VERSION,
		iv.toString("base64"),
		authTag.toString("base64"),
		encrypted.toString("base64"),
	].join(":");
}

export function decryptSecret(payload: string, secret: string): string {
	try {
		const parts = payload.split(":");

		if (parts.length !== 4) {
			throw new Error("Invalid encrypted secret format");
		}

		const [version, ivBase64, authTagBase64, encryptedBase64] = parts;

		if (
			version !== KEY_VERSION ||
			!ivBase64 ||
			!authTagBase64 ||
			!encryptedBase64
		) {
			throw new Error("Invalid encrypted secret format");
		}

		const decipher = createDecipheriv(
			ALGORITHM,
			deriveKey(secret),
			Buffer.from(ivBase64, "base64"),
		);
		decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

		return Buffer.concat([
			decipher.update(Buffer.from(encryptedBase64, "base64")),
			decipher.final(),
		]).toString("utf8");
	} catch (err) {
		throw new Error("Unable to decrypt secret", { cause: err });
	}
}

export function maskSecret(secret: string): string {
	if (secret.length < MIN_PARTIALLY_MASKED_LENGTH) {
		return "********";
	}

	return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
