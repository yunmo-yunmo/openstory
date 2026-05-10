"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

interface CreateProjectDialogProps {
	onClose: () => void;
}

export function CreateProjectDialog({ onClose }: CreateProjectDialogProps) {
	const router = useRouter();
	const utils = api.useUtils();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [genre, setGenre] = useState("");

	const nameInputRef = useRef<HTMLInputElement>(null);
	const isSubmittable = name.trim().length > 0;

	const createProject = api.project.create.useMutation({
		onSuccess: async (project) => {
			await utils.project.invalidate();
			router.push(`/${project.id}`);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!isSubmittable || createProject.isPending) return;
		createProject.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
			genre: genre.trim() || undefined,
		});
	};

	const handleOverlayClick = () => {
		if (!createProject.isPending) {
			onClose();
		}
	};

	// Focus the name input on mount
	useEffect(() => {
		nameInputRef.current?.focus();
	}, []);

	// Close on Escape
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !createProject.isPending) {
				onClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose, createProject.isPending]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
			<button
				aria-label="关闭新建项目窗口"
				className="absolute inset-0 cursor-default"
				disabled={createProject.isPending}
				onClick={handleOverlayClick}
				type="button"
			/>
			<div className="relative z-10 w-full max-w-md rounded-sm border border-study-600 bg-study-800 shadow-[0_8px_48px_rgba(0,0,0,0.5)]">
				{/* Header */}
				<div className="border-study-600 border-b px-6 py-5">
					<h2 className="font-display text-ink text-xl">新建项目</h2>
					<p className="mt-1 text-ink-muted text-sm">每个故事都始于一个字。</p>
				</div>

				{/* Form */}
				<form className="flex flex-col gap-5 px-6 py-5" onSubmit={handleSubmit}>
					{/* Name */}
					<div className="flex flex-col gap-1.5">
						<label
							className="font-sans text-ink-muted text-xs uppercase tracking-wider"
							htmlFor="project-name"
						>
							名称
						</label>
						<input
							className="rounded-sm border border-study-600 bg-study-900 px-3 py-2.5 font-sans text-ink transition-colors placeholder:text-ink-dim/60 focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
							id="project-name"
							onChange={(e) => setName(e.target.value)}
							placeholder="未命名故事"
							ref={nameInputRef}
							type="text"
							value={name}
						/>
					</div>

					{/* Description */}
					<div className="flex flex-col gap-1.5">
						<label
							className="font-sans text-ink-muted text-xs uppercase tracking-wider"
							htmlFor="project-description"
						>
							简介
							<span className="ml-1 text-ink-dim normal-case">(可选)</span>
						</label>
						<textarea
							className="min-h-[80px] resize-y rounded-sm border border-study-600 bg-study-900 px-3 py-2.5 font-sans text-ink transition-colors placeholder:text-ink-dim/60 focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
							id="project-description"
							onChange={(e) => setDescription(e.target.value)}
							placeholder="简要描述你的故事..."
							rows={3}
							value={description}
						/>
					</div>

					{/* Genre */}
					<div className="flex flex-col gap-1.5">
						<label
							className="font-sans text-ink-muted text-xs uppercase tracking-wider"
							htmlFor="project-genre"
						>
							类型
							<span className="ml-1 text-ink-dim normal-case">(可选)</span>
						</label>
						<input
							className="rounded-sm border border-study-600 bg-study-900 px-3 py-2.5 font-sans text-ink transition-colors placeholder:text-ink-dim/60 focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
							id="project-genre"
							onChange={(e) => setGenre(e.target.value)}
							placeholder="奇幻、悬疑、言情..."
							type="text"
							value={genre}
						/>
					</div>

					{/* Error state */}
					{createProject.error && (
						<p className="rounded-sm border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-sm">
							{createProject.error.message ?? "出了点问题，请重试。"}
						</p>
					)}

					{/* Actions */}
					<div className="flex items-center justify-end gap-3 border-study-600 border-t pt-5">
						<button
							className="rounded-sm border border-study-600 px-4 py-2 font-sans text-ink-muted text-sm transition-colors hover:border-study-500 hover:bg-study-700 hover:text-ink"
							disabled={createProject.isPending}
							onClick={onClose}
							type="button"
						>
							取消
						</button>
						<button
							className="rounded-sm border border-amber/50 bg-amber/10 px-6 py-2 font-sans text-amber text-sm transition-all duration-300 hover:border-amber hover:bg-amber/20 hover:shadow-[0_0_16px_var(--color-amber-glow)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-amber/50 disabled:hover:bg-amber/10 disabled:hover:shadow-none"
							disabled={!isSubmittable || createProject.isPending}
							type="submit"
						>
							{createProject.isPending ? (
								<span className="inline-flex items-center gap-2">
									<svg
										aria-hidden="true"
										className="h-3.5 w-3.5 animate-spin"
										fill="none"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										/>
										<path
											className="opacity-75"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
											fill="currentColor"
										/>
									</svg>
									创建中...
								</span>
							) : (
								"创建项目"
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
