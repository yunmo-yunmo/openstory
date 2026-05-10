import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { prepareImportData } from "./chapter-import";
import { plainTextToTipTap } from "./tiptap-converter";

describe("prepareImportData", () => {
	test("maps split results to chapter creation data with TipTap content", () => {
		const splits = [
			{ title: "第一章 开始", content: "这是第一章的内容。" },
			{ title: "第二章 继续", content: "这是第二章的内容。" },
		];

		const result = prepareImportData(splits);

		assert.equal(result.length, 2);
		assert.equal(result[0]?.title, "第一章 开始");
		assert.equal(result[0]?.order, 0);
		assert.equal(result[0]?.content, plainTextToTipTap("这是第一章的内容。"));
		assert.equal(result[1]?.title, "第二章 继续");
		assert.equal(result[1]?.order, 1);
	});

	test("assigns sequential order starting from offset", () => {
		const splits = [
			{ title: "A", content: "内容A" },
			{ title: "B", content: "内容B" },
			{ title: "C", content: "内容C" },
		];

		const result = prepareImportData(splits, 5);

		assert.equal(result[0]?.order, 5);
		assert.equal(result[1]?.order, 6);
		assert.equal(result[2]?.order, 7);
	});

	test("handles empty splits array", () => {
		const result = prepareImportData([]);
		assert.deepEqual(result, []);
	});

	test("converts content to TipTap JSON and computes word counts", () => {
		const splits = [{ title: "Test", content: "Hello world" }];

		const result = prepareImportData(splits);

		assert.equal(result[0]?.content, plainTextToTipTap("Hello world"));
		assert.equal(result[0]?.wordCount, 2);
	});

	test("handles chapter with empty content", () => {
		const splits = [{ title: "空章节", content: "" }];

		const result = prepareImportData(splits);

		assert.equal(result[0]?.content, plainTextToTipTap(""));
		assert.equal(result[0]?.wordCount, 0);
	});
});
