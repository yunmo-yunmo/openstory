import type { ReactNode } from "react";
import { VolumeLabel } from "./decorative";
import { cn } from "./utils";

export function PanelHeader({
	volume,
	title,
	description,
	action,
	className,
}: {
	volume?: string;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<header
			className={cn(
				"mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
				className,
			)}
		>
			<div>
				{volume && <VolumeLabel className="mb-2">{volume}</VolumeLabel>}
				<h2 className="font-display text-3xl text-ink leading-tight">
					{title}
				</h2>
				{description && (
					<p className="mt-1 text-ink-muted text-sm leading-relaxed">
						{description}
					</p>
				)}
			</div>
			{action}
		</header>
	);
}
