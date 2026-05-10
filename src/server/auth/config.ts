import { PrismaAdapter } from "@auth/prisma-adapter";
import { headers } from "next/headers";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";

import { env } from "~/env";
import { getOrCreateLocalUser } from "~/server/auth/local-user";
import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			// ...other properties
			// role: UserRole;
		} & DefaultSession["user"];
	}

	// interface User {
	//   // ...other properties
	//   // role: UserRole;
	// }
}

declare module "@auth/core/jwt" {
	interface JWT {
		id?: string;
	}
}

const providers: NextAuthConfig["providers"] = [];

if (env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET) {
	providers.push(DiscordProvider);
}

if (env.ENABLE_LOCAL_USER_MODE === "true") {
	providers.push(
		CredentialsProvider({
			id: "local-user",
			name: "Local User",
			credentials: {},
			async authorize() {
				const headersList = await headers();
				const host = headersList.get("host") ?? "";
				const isLocalHost =
					host === "localhost" || host.startsWith("localhost:");
				const isLocalIp = host === "127.0.0.1" || host.startsWith("127.0.0.1:");
				const isLocal = isLocalHost || isLocalIp;

				if (!isLocal) {
					return null; // Deny login from non-local hosts
				}

				const user = await getOrCreateLocalUser(db);
				return {
					id: user.id,
					email: user.email,
					name: user.name,
				};
			},
		}),
	);
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
	providers,
	adapter: PrismaAdapter(db),
	session: { strategy: "jwt" },
	callbacks: {
		jwt: ({ token, user }) => {
			if (user?.id) token.id = user.id;
			return token;
		},
		session: ({ session, token }) => ({
			...session,
			user: {
				...session.user,
				id: String(token.id ?? token.sub),
			},
		}),
	},
} satisfies NextAuthConfig;
