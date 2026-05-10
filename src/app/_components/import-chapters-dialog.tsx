"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { splitChapters } from "~/server/services/chapter-splitter";
import { api } from "~/trpc/react";

interface ImportChaptersDialogProps {
	projectId: string;
	onClose: () => void;
}

export function ImportChaptersDialog({
	projectId,
	onClose,
}: ImportChaptersDialogProps) {
	const utils = api.useUtils();

	const [text, setText] = useState("");
	const [fileName, setFileName] = useState("");
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const splits = text.trim() ? splitChapters(text) : [];

	const importChapters = api.chapter.importChapters.useMutation({
		onSuccess: async () => {
			await utils.chapter.listByProject.invalidate({ projectId });
			onClose();
		},
	});

	const handleFile = useCallback((file: File) => {
		setFileName(file.name);
		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result;
			if (typeof result === "string") {
				setText(result);
			}
		};
		reader.readAsText(file);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			const file = e.dataTransfer.files[0];
			if (file) handleFile(file);
		},
		[handleFile],
	);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) handleFile(file);
		},
		[handleFile],
	);

	const handleConfirm = () => {
		if (!text.trim() || importChapters.isPending) return;
		importChapters.mutate({ projectId, text });
	};

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !importChapters.isPending) {
				onClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose, importChapters.isPending]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
			<button
				aria-label="关闭导入文本窗口"
				className="absolute inset-0 cursor-default"
				disabled={importChapters.isPending}
				onClick={onClose}
				type="button"
			/>
			<div
				className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-sm border border-study-600 bg-study-800 shadow-[0_8px_48px_rgba(0,0,0,0.5)]"
				role="dialog"
			>
				{/* Header */}
				<div className="shrink-0 border-study-600 border-b px-6 py-5">
					<h2 className="font-display text-ink text-xl">导入文本</h2>
					<p className="mt-1 text-ink-muted text-sm">
						上传 TXT/MD 文件，自动识别章节结构。
					</p>
				</div>

				{/* Body */}
				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
					{/* Drop zone */}
					{!text && (
						/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop zone requires div */
						<div
							className={`flex flex-col items-center gap-3 rounded-sm border-2 border-dashed px-6 py-10 transition-colors ${
								isDragging
									? "border-amber/60 bg-amber/5"
									: "border-study-600 bg-study-900/50"
							}`}
							onDragLeave={() => setIsDragging(false)}
							onDragOver={(e) => {
								e.preventDefault();
								setIsDragging(true);
							}}
							onDrop={handleDrop}
						>
							<svg
								aria-hidden="true"
								className="h-8 w-8 text-ink-dim"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							<p className="font-sans text-ink-dim text-sm">
								拖拽文件到此处，或
							</p>
							<button
								className="rounded-sm border border-amber/40 bg-amber/10 px-4 py-1.5 font-sans text-amber text-sm transition-colors hover:border-amber hover:bg-amber/20"
								onClick={() => fileInputRef.current?.click()}
								type="button"
							>
								选择文件
							</button>
							<input
								accept=".txt,.md,.text"
								className="hidden"
								onChange={handleFileChange}
								ref={fileInputRef}
								type="file"
							/>
						</div>
					)}

					{/* File info + preview */}
					{text && (
						<>
							<div className="flex items-center gap-3 rounded-sm border border-study-600 bg-study-700/50 px-4 py-3">
								<span className="font-sans text-ink-muted text-sm">
									{fileName || "粘贴文本"}
								</span>
								<span className="font-mono text-ink-dim text-xs">
									{splits.length} 个章节
								</span>
								<div className="flex-1" />
								<button
									className="font-sans text-ink-dim text-xs transition-colors hover:text-ink-muted"
									onClick={() => {
										setText("");
										setFileName("");
									}}
									type="button"
								>
									重新选择
								</button>
							</div>

							{/* Chapter preview list */}
							{splits.length > 0 && (
								<div className="flex flex-col gap-2">
									<h3 className="font-sans text-ink-dim text-xs uppercase tracking-wider">
										章节预览
									</h3>
									<div className="max-h-[300px] overflow-y-auto">
										{splits.map((split, i) => (
											<div
												className="flex gap-3 border-study-600 border-b px-2 py-2 last:border-b-0"
												key={split.title}
											>
												<span className="shrink-0 font-mono text-ink-dim text-xs">
													{i + 1}
												</span>
												<div className="min-w-0 flex-1">
													<p className="truncate font-sans text-ink text-sm">
														{split.title}
													</p>
													<p className="mt-0.5 truncate font-sans text-ink-dim text-xs">
														{split.content.slice(0, 50)}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{splits.length === 0 && (
								<p className="py-4 text-center font-sans text-ink-dim text-sm italic">
									未检测到章节结构，整个文本将作为单个章节导入。
								</p>
							)}
						</>
					)}

					{/* Error */}
					{importChapters.error && (
						<p className="rounded-sm border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-sm">
							{importChapters.error.message ?? "导入失败，请重试。"}
						</p>
					)}
				</div>

				{/* Actions */}
				<div className="shrink-0 border-study-600 border-t px-6 py-4">
					<div className="flex items-center justify-end gap-3">
						<button
							className="rounded-sm border border-study-600 px-4 py-2 font-sans text-ink-muted text-sm transition-colors hover:border-study-500 hover:bg-study-700 hover:text-ink"
							disabled={importChapters.isPending}
							onClick={onClose}
							type="button"
						>
							取消
						</button>
						<button
							className="rounded-sm border border-amber/50 bg-amber/10 px-6 py-2 font-sans text-amber text-sm transition-all duration-300 hover:border-amber hover:bg-amber/20 hover:shadow-[0_0_16px_var(--color-amber-glow)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-amber/50 disabled:hover:bg-amber/10 disabled:hover:shadow-none"
							disabled={!text.trim() || importChapters.isPending}
							onClick={handleConfirm}
							type="button"
						>
							{importChapters.isPending ? (
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
									导入中...
								</span>
							) : (
								`导入 ${splits.length} 个章节`
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
