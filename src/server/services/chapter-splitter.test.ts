import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { type SplitResult, splitChapters } from "./chapter-splitter";

describe("splitChapters", () => {
	test("splits on 第X章 pattern", () => {
		const input = [
			"第一章 开始",
			"这是第一章的内容。",
			"",
			"第二章 继续",
			"这是第二章的内容。",
		].join("\n");

		const result = splitChapters(input);

		assert.deepEqual(result, [
			{ title: "第一章 开始", content: "这是第一章的内容。" },
			{ title: "第二章 继续", content: "这是第二章的内容。" },
		] satisfies SplitResult[]);
	});

	test("splits on 第X卷 pattern", () => {
		const input = [
			"第一卷 春",
			"卷一内容。",
			"",
			"第二卷 夏",
			"卷二内容。",
		].join("\n");

		const result = splitChapters(input);

		assert.deepEqual(result, [
			{ title: "第一卷 春", content: "卷一内容。" },
			{ title: "第二卷 夏", content: "卷二内容。" },
		] satisfies SplitResult[]);
	});

	test("splits on Chapter X pattern (English)", () => {
		const input = [
			"Chapter 1",
			"The beginning.",
			"",
			"Chapter 2",
			"The continuation.",
		].join("\n");

		const result = splitChapters(input);

		assert.deepEqual(result, [
			{ title: "Chapter 1", content: "The beginning." },
			{ title: "Chapter 2", content: "The continuation." },
		] satisfies SplitResult[]);
	});

	test("splits on separator lines (=== / *** / ---)", () => {
		const input = [
			"第一部分",
			"内容一。",
			"==========",
			"第二部分",
			"内容二。",
		].join("\n");

		const result = splitChapters(input);

		assert.deepEqual(result, [
			{ title: "第一部分", content: "内容一。" },
			{ title: "第二部分", content: "内容二。" },
		] satisfies SplitResult[]);
	});

	test("splits on 5+ consecutive blank lines as fallback", () => {
		const content = "前奏内容。";
		const input = [
			"第一段",
			content,
			"",
			"",
			"",
			"",
			"",
			"第二段",
			"后续内容。",
		].join("\n");

		const result = splitChapters(input);

		assert.equal(result.length, 2);
		assert.equal(result[0]?.title, "第一段");
		assert.equal(result[1]?.title, "第二段");
	});

	test("regex patterns take priority over separator and blank lines", () => {
		const input = [
			"第一章 开头",
			"内容。",
			"==========",
			"第二章 中间",
			"更多内容。",
		].join("\n");

		const result = splitChapters(input);

		assert.equal(result.length, 2);
		assert.equal(result[0]?.title, "第一章 开头");
		assert.equal(result[1]?.title, "第二章 中间");
	});

	test("returns entire content as single chapter when no split markers found", () => {
		const input = "这是一段没有章节标记的文本。\n它只是一段普通的文字。";

		const result = splitChapters(input);

		assert.deepEqual(result, [
			{ title: "未命名章节", content: input },
		] satisfies SplitResult[]);
	});

	test("handles empty input", () => {
		const result = splitChapters("");
		assert.deepEqual(result, []);
	});

	test("strips leading/trailing whitespace from content", () => {
		const input = [
			"第一章 测试",
			"  ",
			"  内容文本。  ",
			"  ",
			"第二章 结束",
			"结尾内容。",
		].join("\n");

		const result = splitChapters(input);

		assert.equal(result[0]?.content, "内容文本。");
	});

	test("handles mixed Chinese and English chapter patterns", () => {
		const input = [
			"Chapter 1 The Beginning",
			"English content.",
			"",
			"第三章 中间",
			"中文内容。",
			"",
			"CHAPTER 4 The End",
			"More English.",
		].join("\n");

		const result = splitChapters(input);

		assert.equal(result.length, 3);
		assert.equal(result[0]?.title, "Chapter 1 The Beginning");
		assert.equal(result[1]?.title, "第三章 中间");
		assert.equal(result[2]?.title, "CHAPTER 4 The End");
	});
});
