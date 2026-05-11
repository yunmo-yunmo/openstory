import { PrismaClient } from "@prisma/client";
import { env } from "~/env";
import { resolvePrismaDatasourceUrl } from "./services/prisma-datasource-url";

const createPrismaClient = () =>
	new PrismaClient({
		datasources: {
			db: {
				url: resolvePrismaDatasourceUrl(env.DATABASE_URL),
			},
		},
		log:
			env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
	});

const globalForPrisma = globalThis as unknown as {
	prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
