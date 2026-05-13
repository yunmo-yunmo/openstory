"use client";

import type { SelectionData } from "./extensions/selection-trigger";
import type { AIOperation } from "./story-bible-types";
import { AI_OPERATIONS } from "./story-bible-types";

export type { AIOperation };

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
