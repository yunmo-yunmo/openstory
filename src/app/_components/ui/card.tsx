import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

export function Card({
	className,
	children,
	ornate = false,
	...props
}: HTMLAttributes<HTMLDivElement> & {
	children: ReactNode;
	ornate?: boolean;
}) {
	return (
		<div
			className={cn(
				"rounded border border-study-600 bg-study-800 transition-all duration-300 ease-out hover:border-amber/50 hover:shadow-[var(--library-shadow)]",
				ornate && "corner-flourish",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function PanelFrame({
	className,
	children,
	...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
	return (
		<div
			className={cn(
				"ornate-frame rounded border border-study-600 bg-study-800/80",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
