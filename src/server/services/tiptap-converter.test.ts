import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { plainTextToTipTap, tiptapToPlainText } from "./tiptap-converter";

describe("tiptap-converter", () => {
	test("round-trips paragraph breaks and hard breaks as plain text", () => {
		const text = "Line one\nLine two\n\nNext paragraph";

		assert.equal(tiptapToPlainText(plainTextToTipTap(text)), text);
	});
});
