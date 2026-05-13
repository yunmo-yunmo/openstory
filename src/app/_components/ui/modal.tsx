import type { ReactNode } from "react";
import { cn } from "./utils";

export function ModalShell({
	title,
	description,
	children,
	footer,
	onClose,
	ariaLabel,
	className,
	disableOverlayClose = false,
}: {
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	onClose: () => void;
	ariaLabel: string;
	className?: string;
	disableOverlayClose?: boolean;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-study-900/75 px-4 backdrop-blur-sm">
			<button
				aria-label={ariaLabel}
				className="absolute inset-0 cursor-default"
				disabled={disableOverlayClose}
				onClick={() => {
					if (!disableOverlayClose) onClose();
				}}
				type="button"
			/>
			<section
				className={cn(
					"ornate-frame relative z-10 flex max-h-[85vh] w-full flex-col rounded border border-study-600 bg-study-800 shadow-[0_8px_48px_rgba(0,0,0,0.5)]",
					className,
				)}
			>
				<header className="shrink-0 border-study-600 border-b px-6 py-5">
					<p className="mb-2 font-label text-amber text-[10px] uppercase tracking-[0.28em]">
						Proclamation
					</p>
					<h2 className="font-display text-2xl text-ink leading-tight">
						{title}
					</h2>
					{description && (
						<p className="mt-1 text-ink-muted text-sm leading-relaxed">
							{description}
						</p>
					)}
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
				{footer && (
					<footer className="shrink-0 border-study-600 border-t px-6 py-4">
						{footer}
					</footer>
				)}
			</section>
		</div>
	);
}
