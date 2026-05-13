import {
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useRef,
} from "react";
import { cn } from "./utils";

const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"[tabindex]:not([tabindex='-1'])",
].join(", ");

export function ModalShell({
	title,
	description,
	children,
	footer,
	onClose,
	ariaLabel,
	className,
	disableOverlayClose = false,
	disableEscapeClose = false,
}: {
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	onClose: () => void;
	ariaLabel: string;
	className?: string;
	disableOverlayClose?: boolean;
	disableEscapeClose?: boolean;
}) {
	const titleId = useId();
	const descriptionId = useId();
	const sectionRef = useRef<HTMLElement>(null);
	const previousActiveElementRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousActiveElementRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

		const focusableElements =
			sectionRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
		const firstFocusable = focusableElements?.[0];

		if (firstFocusable) {
			firstFocusable.focus();
			return;
		}

		sectionRef.current?.focus();
	}, []);

	useEffect(() => {
		return () => {
			previousActiveElementRef.current?.focus();
		};
	}, []);

	const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
		if (event.key === "Escape") {
			if (!disableEscapeClose) {
				event.preventDefault();
				onClose();
			}
			return;
		}

		if (event.key !== "Tab") return;

		const focusableElements =
			sectionRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
			[];
		if (focusableElements.length === 0) {
			event.preventDefault();
			sectionRef.current?.focus();
			return;
		}

		const firstFocusable = focusableElements[0];
		const lastFocusable = focusableElements[focusableElements.length - 1];
		if (!firstFocusable || !lastFocusable) {
			return;
		}
		const activeElement =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

		if (event.shiftKey && activeElement === firstFocusable) {
			event.preventDefault();
			lastFocusable.focus();
			return;
		}

		if (!event.shiftKey && activeElement === lastFocusable) {
			event.preventDefault();
			firstFocusable.focus();
		}
	};

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
				aria-describedby={description ? descriptionId : undefined}
				aria-labelledby={titleId}
				aria-modal="true"
				className={cn(
					"ornate-frame relative z-10 flex max-h-[85vh] w-full flex-col rounded border border-study-600 bg-study-800 shadow-[0_8px_48px_rgba(0,0,0,0.5)]",
					className,
				)}
				onKeyDown={handleKeyDown}
				ref={sectionRef}
				role="dialog"
				tabIndex={-1}
			>
				<header className="shrink-0 border-study-600 border-b px-6 py-5">
					<p className="mb-2 font-label text-[10px] text-amber uppercase tracking-[0.28em]">
						Proclamation
					</p>
					<h2
						className="font-display text-2xl text-ink leading-tight"
						id={titleId}
					>
						{title}
					</h2>
					{description && (
						<p
							className="mt-1 text-ink-muted text-sm leading-relaxed"
							id={descriptionId}
						>
							{description}
						</p>
					)}
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
					{children}
				</div>
				{footer && (
					<footer className="shrink-0 border-study-600 border-t px-6 py-4">
						{footer}
					</footer>
				)}
			</section>
		</div>
	);
}
