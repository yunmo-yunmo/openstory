import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	plainTextToTipTap,
	tiptapToPlainText,
	tiptapToRawText,
} from "./tiptap-converter";

describe("tiptap-converter", () => {
	test("round-trips paragraph breaks and hard breaks as plain text", () => {
		const text = "Line one\nLine two\n\nNext paragraph";

		assert.equal(tiptapToPlainText(plainTextToTipTap(text)), text);
	});

	test("tiptapToRawText extracts text without markdown formatting", () => {
		const doc = JSON.stringify({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Normal " },
						{ type: "text", text: "bold", marks: [{ type: "bold" }] },
						{ type: "text", text: " and " },
						{ type: "text", text: "italic", marks: [{ type: "italic" }] },
					],
				},
			],
		});

		assert.equal(tiptapToRawText(doc), "Normal bold and italic");
	});

	test("tiptapToRawText handles doc with no marks identically to tiptapToPlainText", () => {
		const plainDoc = plainTextToTipTap("Hello world");
		assert.equal(tiptapToRawText(plainDoc), tiptapToPlainText(plainDoc));
	});
});
