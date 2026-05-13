import type { ReactNode } from "react";
import { OrnateDivider, VolumeLabel } from "./decorative";

export function EmptyState({
	icon,
	title,
	description,
	action,
	volume = "Volume I",
}: {
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	volume?: string;
}) {
	return (
		<div className="flex flex-col items-center gap-6 text-center">
			{icon && (
				<div className="flex h-20 w-20 items-center justify-center rounded-full border border-amber/30 bg-study-800/70 text-amber shadow-[var(--brass-shadow)]">
					{icon}
				</div>
			)}
			<div className="flex flex-col items-center gap-3">
				<VolumeLabel>{volume}</VolumeLabel>
				<h2 className="font-display text-3xl text-ink leading-tight">
					{title}
				</h2>
				{description && (
					<p className="max-w-md text-ink-muted text-sm leading-relaxed">
						{description}
					</p>
				)}
			</div>
			<OrnateDivider className="w-48" />
			{action}
		</div>
	);
}
