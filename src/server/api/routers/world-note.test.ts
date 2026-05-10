import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { plainTextToTipTap } from "../../services/tiptap-converter";
import {
	parseWorldNoteTags,
	serializeWorldNoteTags,
	worldNoteToPlainTextSummary,
} from "./world-note-helpers";

describe("world note helpers", () => {
	test("parseWorldNoteTags accepts valid JSON arrays of strings", () => {
		assert.deepEqual(parseWorldNoteTags('["magic","culture"]'), [
			"magic",
			"culture",
		]);
	});

	test("parseWorldNoteTags rejects malformed tag JSON and non-array JSON as empty arrays", () => {
		assert.deepEqual(parseWorldNoteTags("not json"), []);
		assert.deepEqual(parseWorldNoteTags('{"tag":"magic"}'), []);
	});

	test("serializeWorldNoteTags trims blanks and removes duplicates", () => {
		assert.equal(
			serializeWorldNoteTags([" magic ", "", "culture", "magic", "  "]),
			'["magic","culture"]',
		);
	});

	test("worldNoteToPlainTextSummary converts TipTap JSON and truncates text longer than 300 chars", () => {
		const longText = `${"a".repeat(299)}bc`;
		const summary = worldNoteToPlainTextSummary({
			category: "history",
			title: "The Long War",
			content: plainTextToTipTap(longText),
		});

		assert.equal(summary, `- [history] The Long War: ${"a".repeat(299)}b...`);
	});
});
