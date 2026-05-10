import "server-only";
import type { PrismaClient } from "@prisma/client";

export const LOCAL_USER_EMAIL = "local@openstory.local";
export const LOCAL_USER_NAME = "Local User";

export async function getOrCreateLocalUser(db: PrismaClient) {
	return db.user.upsert({
		where: { email: LOCAL_USER_EMAIL },
		update: {},
		create: {
			email: LOCAL_USER_EMAIL,
			name: LOCAL_USER_NAME,
		},
	});
}
