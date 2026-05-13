import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
	primary:
		"brass-gradient border-transparent font-label uppercase tracking-[0.15em] hover:brightness-110 hover:shadow-[0_4px_12px_rgba(201,169,98,0.3)] active:shadow-inner",
	secondary:
		"border-amber/70 bg-transparent font-label text-amber uppercase tracking-[0.15em] hover:border-rust hover:bg-rust hover:text-ink",
	ghost:
		"border-transparent bg-transparent text-amber underline-offset-4 hover:text-amber-light hover:underline",
	danger:
		"border-rust/40 bg-rust/10 text-rust-light hover:border-rust hover:bg-rust/20",
	quiet:
		"border-study-600 bg-study-800/40 text-ink-muted hover:border-amber/40 hover:bg-study-700 hover:text-ink",
};

const sizeClasses: Record<ButtonSize, string> = {
	sm: "min-h-10 px-4 py-2 text-xs",
	md: "min-h-12 px-6 py-2.5 text-xs",
	lg: "min-h-14 px-8 py-3 text-sm",
	icon: "h-10 w-10 p-0",
};

export function Button({
	className,
	variant = "primary",
	size = "md",
	children,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	children: ReactNode;
}) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded border text-center transition-all duration-300 ease-out disabled:pointer-events-none disabled:opacity-50",
				variantClasses[variant],
				sizeClasses[size],
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
}
