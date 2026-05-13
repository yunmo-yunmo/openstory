"use client";

import { FileText, FolderUp, LoaderCircle, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { splitChapters } from "~/server/services/chapter-splitter";
import { api } from "~/trpc/react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ModalShell } from "./ui/modal";

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
		<ModalShell
			ariaLabel="关闭导入文本窗口"
			className="max-w-3xl"
			description="上传 TXT/MD 文件，自动识别章节结构。"
			footer={
				<div className="flex items-center justify-end gap-3">
					<Button disabled={importChapters.isPending} onClick={onClose} size="sm" type="button" variant="quiet">
						取消
					</Button>
					<Button
						disabled={!text.trim() || importChapters.isPending}
						onClick={handleConfirm}
						size="sm"
						type="button"
					>
						{importChapters.isPending ? (
							<>
								<LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
								导入中
							</>
						) : (
							<>
								<FolderUp aria-hidden="true" className="h-4 w-4" />
								导入 {splits.length} 个章节
							</>
						)}
					</Button>
				</div>
			}
			onClose={onClose}
			title="导入文本"
		>
			<div className="flex flex-col gap-5">
				{!text && (
					/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop zone requires div */
					<div
						className={`flex flex-col items-center gap-4 rounded border-2 border-dashed px-6 py-10 transition-colors ${
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
						<FileText aria-hidden="true" className="h-10 w-10 text-amber" />
						<p className="text-ink-dim text-sm">拖拽文件到此处，或</p>
						<Button onClick={() => fileInputRef.current?.click()} size="sm" type="button" variant="secondary">
							选择文件
						</Button>
						<input
							accept=".txt,.md,.text"
							className="hidden"
							onChange={handleFileChange}
							ref={fileInputRef}
							type="file"
						/>
					</div>
				)}

				{text && (
					<>
						<Card className="p-4">
							<div className="flex items-center gap-3">
								<div className="min-w-0 flex-1">
									<p className="truncate text-ink text-sm">{fileName || "粘贴文本"}</p>
									<p className="mt-1 text-ink-dim text-xs">{splits.length} 个章节</p>
								</div>
								<Button
									onClick={() => {
										setText("");
										setFileName("");
									}}
									size="sm"
									type="button"
									variant="quiet"
								>
									<RefreshCcw aria-hidden="true" className="h-4 w-4" />
									重新选择
								</Button>
							</div>
						</Card>

						{splits.length > 0 && (
							<div className="flex flex-col gap-2">
								<p className="font-label text-[10px] uppercase tracking-[0.28em] text-ink-muted">
									章节预览
								</p>
								<div className="max-h-[300px] overflow-y-auto space-y-2">
									{splits.map((split, i) => (
										<Card className="px-3 py-2" key={split.title}>
											<div className="flex gap-3">
												<Badge tone="muted">{i + 1}</Badge>
												<div className="min-w-0 flex-1">
													<p className="truncate text-ink text-sm">{split.title}</p>
													<p className="mt-0.5 truncate text-ink-dim text-xs">
														{split.content.slice(0, 50)}
													</p>
												</div>
											</div>
										</Card>
									))}
								</div>
							</div>
						)}

						{splits.length === 0 && (
							<p className="py-4 text-center text-ink-dim text-sm italic">
								未检测到章节结构，整个文本将作为单个章节导入。
							</p>
						)}
					</>
				)}

				{importChapters.error && (
					<p className="rounded border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-sm">
						{importChapters.error.message ?? "导入失败，请重试。"}
					</p>
				)}
			</div>
		</ModalShell>
	);
}
