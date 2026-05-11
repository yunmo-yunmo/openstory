import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { resolvePrismaDatasourceUrl } from "./prisma-datasource-url";

describe("resolvePrismaDatasourceUrl", () => {
	test("resolves relative SQLite paths from the Prisma schema directory", () => {
		const cwd = path.resolve("E:/repo/openstory");

		assert.equal(
			resolvePrismaDatasourceUrl("file:./db.sqlite", cwd),
			`file:${path.resolve(cwd, "prisma", "./db.sqlite")}`,
		);
	});

	test("leaves non-SQLite, memory, and absolute SQLite URLs unchanged", () => {
		assert.equal(
			resolvePrismaDatasourceUrl("postgresql://example/db"),
			"postgresql://example/db",
		);
		assert.equal(resolvePrismaDatasourceUrl("file::memory:"), "file::memory:");
		assert.equal(
			resolvePrismaDatasourceUrl("file:C:/data/openstory.sqlite"),
			"file:C:/data/openstory.sqlite",
		);
	});
});
