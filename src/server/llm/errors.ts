export type LLMErrorCode =
	| "NO_MODEL_CONFIG"
	| "ENCRYPTION_KEY_MISSING"
	| "API_KEY_DECRYPT_FAILED"
	| "PROVIDER_CONNECTION_FAILED"
	| "MODEL_NOT_FOUND"
	| "PROVIDER_UNREGISTERED";

export class LLMConfigError extends Error {
	constructor(
		public readonly code: LLMErrorCode,
		message: string,
	) {
		super(message);
		this.name = "LLMConfigError";
	}
}
