"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DiffProposal } from "./extensions/inline-diff";

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
						top: rect.top - 40,
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
				<div
					className="fixed z-50 flex items-center gap-1.5 rounded-sm border border-study-600 bg-study-800 px-2 py-1 shadow-lg"
					key={pos.id}
					style={{ top: pos.top, left: pos.left }}
				>
					<button
						className="rounded-sm border border-sage/40 bg-sage/10 px-2 py-0.5 font-sans text-sage text-xs transition-colors hover:border-sage hover:bg-sage/20 disabled:opacity-50"
						disabled={isAccepting}
						onClick={() => onAccept(proposal.id)}
						type="button"
					>
						{isAccepting ? "..." : "采纳"}
					</button>
					<button
						className="rounded-sm border border-rust/40 bg-rust/10 px-2 py-0.5 font-sans text-rust text-xs transition-colors hover:border-rust hover:bg-rust/20 disabled:opacity-50"
						disabled={isRejecting}
						onClick={() => onReject(proposal.id)}
						type="button"
					>
						{isRejecting ? "..." : "拒绝"}
					</button>
				</div>
			);
		}),
		document.body,
	);
}
