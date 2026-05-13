import type { ReactNode } from "react";
import { cn } from "./utils";

export function OrnateDivider({ className }: { className?: string }) {
	return <div aria-hidden="true" className={cn("ornate-divider", className)} />;
}

export function VolumeLabel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<p
			className={cn(
				"font-label text-[10px] text-amber uppercase tracking-[0.28em]",
				className,
			)}
		>
			{children}
		</p>
	);
}

export function WaxSeal({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"wax-seal inline-flex h-10 w-10 items-center justify-center rounded-full text-ink",
				className,
			)}
		>
			{children}
		</span>
	);
}
