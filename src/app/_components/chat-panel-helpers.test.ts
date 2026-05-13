import assert from "node:assert/strict";
import test from "node:test";

import { buildSelectionMessage, isSendDisabled } from "./chat-panel-helpers";

test("buildSelectionMessage formats continue operations without selected-text label", () => {
	assert.equal(
		buildSelectionMessage({
			operationLabel: "续写",
			operation: "continue",
			selectedText: "月光落在旧窗棂上",
		}),
		"续写：月光落在旧窗棂上...",
	);
});

test("buildSelectionMessage formats non-continue operations with selected-text label", () => {
	assert.equal(
		buildSelectionMessage({
			operationLabel: "润色",
			operation: "polish",
			selectedText: "风从走廊尽头吹来",
		}),
		"润色选中的文字：风从走廊尽头吹来...",
	);
});

test("isSendDisabled blocks empty input, missing config, pending sends, and active streaming", () => {
	assert.equal(
		isSendDisabled({
			input: "  ",
			hasUsableConfig: true,
			isMutationPending: false,
			isStreaming: false,
		}),
		true,
	);
	assert.equal(
		isSendDisabled({
			input: "hello",
			hasUsableConfig: false,
			isMutationPending: false,
			isStreaming: false,
		}),
		true,
	);
	assert.equal(
		isSendDisabled({
			input: "hello",
			hasUsableConfig: true,
			isMutationPending: true,
			isStreaming: false,
		}),
		true,
	);
	assert.equal(
		isSendDisabled({
			input: "hello",
			hasUsableConfig: true,
			isMutationPending: false,
			isStreaming: true,
		}),
		true,
	);
	assert.equal(
		isSendDisabled({
			input: "hello",
			hasUsableConfig: true,
			isMutationPending: false,
			isStreaming: false,
		}),
		false,
	);
});
