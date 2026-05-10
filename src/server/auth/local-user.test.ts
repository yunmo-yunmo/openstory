import assert from "node:assert/strict";
import test from "node:test";
import { getOrCreateLocalUser } from "./local-user";

test("getOrCreateLocalUser atomically upserts the local user", async () => {
	const calls: Array<{
		where: { email: string };
		update: Record<string, never>;
		create: { email: string; name: string };
	}> = [];
	const db = {
		user: {
			upsert: async (args: {
				where: { email: string };
				update: Record<string, never>;
				create: { email: string; name: string };
			}) => {
				calls.push(args);
				return { id: "user-1", ...args.create };
			},
		},
	};

	const user = await getOrCreateLocalUser(db as never);

	assert.equal(user.id, "user-1");
	assert.deepEqual(calls, [
		{
			where: { email: "local@openstory.local" },
			update: {},
			create: { email: "local@openstory.local", name: "Local User" },
		},
	]);
});
