"use client";

import type { SelectionData } from "./extensions/selection-trigger";

const AI_OPERATIONS = [
	{ key: "rewrite", label: "改写" },
	{ key: "polish", label: "润色" },
	{ key: "expand", label: "扩写" },
	{ key: "shorten", label: "缩写" },
	{ key: "continue", label: "续写" },
] as const;

export type AIOperation = (typeof AI_OPERATIONS)[number]["key"];

export function SelectionMenu({
	selection,
	position,
	onAction,
}: {
	selection: SelectionData;
	position: { top: number; left: number } | null;
	onAction: (operation: AIOperation, selection: SelectionData) => void;
}) {
	if (!position) return null;

	return (
		<div
			className="fixed z-50 flex items-center gap-1 rounded-sm border border-study-600 bg-study-800 px-1.5 py-1 shadow-lg"
			style={{ top: position.top - 45, left: position.left }}
		>
			{AI_OPERATIONS.map((op) => (
				<button
					className="rounded-sm px-2 py-1 font-sans text-ink-muted text-xs transition-colors hover:bg-study-700 hover:text-ink"
					key={op.key}
					onClick={() => onAction(op.key, selection)}
					title={op.label}
					type="button"
				>
					{op.label}
				</button>
			))}
		</div>
	);
}
