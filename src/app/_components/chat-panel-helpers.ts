import type { AIOperation } from "./selection-menu";

export function buildSelectionMessage({
	operationLabel,
	operation,
	selectedText,
}: {
	operationLabel: string;
	operation: AIOperation;
	selectedText: string;
}) {
	return (
		operationLabel +
		(operation === "continue" ? "" : "选中的文字") +
		"：" +
		selectedText.slice(0, 50) +
		"..."
	);
}

export function isSendDisabled({
	input,
	hasUsableConfig,
	isMutationPending,
	isStreaming,
}: {
	input: string;
	hasUsableConfig: boolean;
	isMutationPending: boolean;
	isStreaming: boolean;
}) {
	return !input.trim() || !hasUsableConfig || isMutationPending || isStreaming;
}
