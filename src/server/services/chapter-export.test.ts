import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatChapterExport } from "./chapter-export";

describe("formatChapterExport", () => {
	test("formats chapters as text with title headers", () => {
		const chapters = [
			{
				title: "第一章 开始",
				content:
					'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"这是第一章内容。"}]}]}',
			},
			{
				title: "第二章 继续",
				content:
					'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"这是第二章内容。"}]}]}',
			},
		];

		const result = formatChapterExport(chapters);

		assert.ok(result.includes("第一章 开始"));
		assert.ok(result.includes("这是第一章内容。"));
		assert.ok(result.includes("第二章 继续"));
		assert.ok(result.includes("这是第二章内容。"));
	});

	test("separates chapters with blank lines", () => {
		const chapters = [
			{
				title: "A",
				content:
					'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"内容A"}]}]}',
			},
			{
				title: "B",
				content:
					'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"内容B"}]}]}',
			},
		];

		const result = formatChapterExport(chapters);
		const parts = result.split("\n\n\n");

		assert.equal(parts.length, 2);
	});

	test("handles chapters with plain text content (non-TipTap)", () => {
		const chapters = [{ title: "测试", content: "普通文本内容" }];

		const result = formatChapterExport(chapters);

		assert.ok(result.includes("普通文本内容"));
	});

	test("handles empty chapters array", () => {
		const result = formatChapterExport([]);
		assert.equal(result, "");
	});
});
