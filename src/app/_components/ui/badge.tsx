import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type BadgeTone = "brass" | "muted" | "sage" | "danger";

const toneClasses: Record<BadgeTone, string> = {
	brass: "border-amber/50 bg-amber/10 text-amber",
	muted: "border-study-500 bg-study-700/50 text-ink-muted",
	sage: "border-sage/40 bg-sage/10 text-sage-light",
	danger: "border-rust/40 bg-rust/10 text-rust-light",
};

export function Badge({
	className,
	tone = "muted",
	children,
	...props
}: HTMLAttributes<HTMLSpanElement> & {
	tone?: BadgeTone;
	children: ReactNode;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded border px-2 py-0.5 font-label text-[10px] uppercase tracking-[0.2em]",
				toneClasses[tone],
				className,
			)}
			{...props}
		>
			{children}
		</span>
	);
}
