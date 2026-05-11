import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildOutlineTreeLabel,
	buildOutlineUpdateData,
	wouldCreateOutlineCycle,
} from "./outline-helpers";

describe("outline helpers", () => {
	test("buildOutlineTreeLabel includes status, title, description, and chapter id", () => {
		const label = buildOutlineTreeLabel({
			status: "writing",
			title: "The Door Opens",
			description: "A hidden room changes the plan.",
			chapterId: "chapter-1",
		});

		assert.match(label, /writing/);
		assert.match(label, /The Door Opens/);
		assert.match(label, /A hidden room changes the plan\./);
		assert.match(label, /chapter-1/);
	});

	test("buildOutlineUpdateData omits undefined and preserves null", () => {
		assert.deepEqual(
			buildOutlineUpdateData({
				title: undefined,
				description: null,
				order: 2,
				parentId: undefined,
				chapterId: null,
			}),
			{
				description: null,
				order: 2,
				chapterId: null,
			},
		);
	});

	test("wouldCreateOutlineCycle detects direct and indirect cycles", () => {
		const outlines = [
			{ id: "root", parentId: null },
			{ id: "child", parentId: "root" },
			{ id: "grandchild", parentId: "child" },
		];

		assert.equal(wouldCreateOutlineCycle(outlines, "root", "root"), true);
		assert.equal(wouldCreateOutlineCycle(outlines, "root", "child"), true);
		assert.equal(wouldCreateOutlineCycle(outlines, "root", "grandchild"), true);
		assert.equal(
			wouldCreateOutlineCycle(outlines, "grandchild", "root"),
			false,
		);
		assert.equal(wouldCreateOutlineCycle(outlines, "child", null), false);
	});
});
