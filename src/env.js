import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const localUserModeEnabled = process.env.ENABLE_LOCAL_USER_MODE === "true";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		AUTH_SECRET:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		AUTH_DISCORD_ID: localUserModeEnabled ? z.string().optional() : z.string(),
		AUTH_DISCORD_SECRET: localUserModeEnabled
			? z.string().optional()
			: z.string(),
		ENABLE_LOCAL_USER_MODE: z.enum(["true", "false"]).default("false"),
		DATABASE_URL: z.string().min(1),
		LLM_ENCRYPTION_KEY: z.string().optional(),
		ANTHROPIC_API_KEY: z.string().optional(),
		OPENAI_API_KEY: z.string().optional(),
		OPENAI_BASE_URL: z.string().url().optional(),
		OPENAI_MODEL: z.string().optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		// NEXT_PUBLIC_CLIENTVAR: z.string(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		AUTH_SECRET: process.env.AUTH_SECRET,
		AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
		AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
		ENABLE_LOCAL_USER_MODE: process.env.ENABLE_LOCAL_USER_MODE,
		DATABASE_URL: process.env.DATABASE_URL,
		LLM_ENCRYPTION_KEY: process.env.LLM_ENCRYPTION_KEY,
		ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
		OPENAI_MODEL: process.env.OPENAI_MODEL,
		NODE_ENV: process.env.NODE_ENV,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
