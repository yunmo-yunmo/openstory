"use client";

import type { SelectionData } from "./extensions/selection-trigger";
import type { AIOperation } from "./story-bible-types";
import { AI_OPERATIONS } from "./story-bible-types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

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
		<Card
			className="fixed z-50 flex items-center gap-1 p-1"
			style={{ top: position.top - 45, left: position.left }}
		>
			{AI_OPERATIONS.map((op) => (
				<Button
					key={op.key}
					onClick={() => onAction(op.key, selection)}
					size="sm"
					title={op.label}
					type="button"
					variant="quiet"
				>
					{op.label}
				</Button>
			))}
		</Card>
	);
}
