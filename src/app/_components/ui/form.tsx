import type {
	ForwardedRef,
	InputHTMLAttributes,
	LabelHTMLAttributes,
	ReactNode,
	SelectHTMLAttributes,
	TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";
import { cn } from "./utils";

export function Field({
	label,
	children,
	className,
}: {
	label?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			{label}
			{children}
		</div>
	);
}

export function Label({
	children,
	className,
	htmlFor,
	...props
}: LabelHTMLAttributes<HTMLLabelElement> & {
	children?: ReactNode;
	htmlFor: string;
}) {
	return (
		<label
			className={cn(
				"font-label text-ink-muted text-xs uppercase tracking-[0.22em]",
				className,
			)}
			htmlFor={htmlFor}
			{...props}
		>
			{children}
		</label>
	);
}

const inputClass =
	"rounded border border-study-600 bg-study-800 px-3 py-2.5 font-sans text-ink text-sm transition-colors placeholder:font-sans placeholder:text-ink-dim/70 placeholder:italic focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/25 disabled:cursor-not-allowed disabled:opacity-50";

export const TextInput = forwardRef(function TextInput(
	{ className, ...props }: InputHTMLAttributes<HTMLInputElement>,
	ref: ForwardedRef<HTMLInputElement>,
) {
	return <input className={cn(inputClass, className)} ref={ref} {...props} />;
});

export function TextArea({
	className,
	...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea className={cn(inputClass, "resize-y", className)} {...props} />
	);
}

export function Select({
	className,
	...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return <select className={cn(inputClass, className)} {...props} />;
}
