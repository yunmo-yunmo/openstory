"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DiffProposal } from "./extensions/inline-diff";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function InlineDiffToolbar({
	proposals,
	onAccept,
	onReject,
	isAccepting,
	isRejecting,
}: {
	proposals: DiffProposal[];
	onAccept: (id: string) => void;
	onReject: (id: string) => void;
	isAccepting: boolean;
	isRejecting: boolean;
}) {
	const [positions, setPositions] = useState<
		Array<{ id: string; top: number; left: number }>
	>([]);

	useEffect(() => {
		const update = () => {
			const items: Array<{ id: string; top: number; left: number }> = [];
			for (const proposal of proposals) {
				const el = document.querySelector(
					`[data-proposal-id="${proposal.id}"]`,
				);
				if (el) {
					const rect = el.getBoundingClientRect();
					items.push({
						id: proposal.id,
						top: rect.top - 44,
						left: rect.left,
					});
				}
			}
			setPositions(items);
		};

		update();
		const interval = setInterval(update, 500);
		return () => clearInterval(interval);
	}, [proposals]);

	if (positions.length === 0) return null;

	return createPortal(
		positions.map((pos) => {
			const proposal = proposals.find((p) => p.id === pos.id);
			if (!proposal || proposal.status !== "pending") return null;

			return (
				<Card
					className="fixed z-50 flex items-center gap-2 p-1"
					key={pos.id}
					style={{ top: pos.top, left: pos.left }}
				>
					<Button
						disabled={isAccepting}
						onClick={() => onAccept(proposal.id)}
						size="sm"
						type="button"
						variant="quiet"
					>
						<Check aria-hidden="true" className="h-4 w-4" />
						{isAccepting ? "..." : "采纳"}
					</Button>
					<Button
						disabled={isRejecting}
						onClick={() => onReject(proposal.id)}
						size="sm"
						type="button"
						variant="danger"
					>
						<X aria-hidden="true" className="h-4 w-4" />
						{isRejecting ? "..." : "拒绝"}
					</Button>
				</Card>
			);
		}),
		document.body,
	);
}
