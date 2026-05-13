"use client";

import { ArrowLeftToLine, Download, Import, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import { ImportChaptersDialog } from "./import-chapters-dialog";
import type { WorkspaceMode } from "./story-bible-types";
import { workspaceModes } from "./story-bible-types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { VolumeLabel } from "./ui/decorative";

function statusDot(status: string) {
	switch (status) {
		case "draft":
			return <span className="h-2 w-2 rounded-full bg-sage" />;
		case "review":
			return <span className="h-2 w-2 rounded-full bg-amber" />;
		case "complete":
			return <span className="h-2 w-2 rounded-full bg-ink-dim" />;
		default:
			return <span className="h-2 w-2 rounded-full bg-ink-dim" />;
	}
}

export function ProjectSidebar({
	projectId,
	selectedChapterId,
	onSelectChapter,
	activeSessionId,
	onSelectSession,
	workspaceMode,
	onWorkspaceModeChange,
}: {
	projectId: string;
	selectedChapterId: string | null;
	onSelectChapter: (id: string) => void;
	activeSessionId: string | null;
	onSelectSession: (id: string) => void;
	workspaceMode: WorkspaceMode;
	onWorkspaceModeChange: (mode: WorkspaceMode) => void;
}) {
	const router = useRouter();
	const [showCreateChapter, setShowCreateChapter] = useState(false);
	const [showImportDialog, setShowImportDialog] = useState(false);
	const [newChapterTitle, setNewChapterTitle] = useState("");

	const [project] = api.project.getById.useSuspenseQuery({ id: projectId });
	const [chapters] = api.chapter.listByProject.useSuspenseQuery({ projectId });
	const [sessions] = api.session.list.useSuspenseQuery({ projectId });

	const utils = api.useUtils();
	const createChapter = api.chapter.create.useMutation({
		onSuccess: async (newChapter) => {
			setNewChapterTitle("");
			setShowCreateChapter(false);
			await utils.chapter.listByProject.invalidate({ projectId });
			onSelectChapter(newChapter.id);
		},
	});

	const handleCreateChapter = () => {
		const trimmed = newChapterTitle.trim();
		if (!trimmed) return;
		const lastChapter =
			chapters.length > 0 ? chapters[chapters.length - 1] : null;
		const nextOrder = lastChapter ? lastChapter.order + 1 : 1;
		createChapter.mutate({
			projectId,
			title: trimmed,
			order: nextOrder,
		});
	};

	const handleExport = async () => {
		const text = await utils.chapter.exportChapters.fetch({ projectId });
		const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${project?.title ?? "export"}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<>
			<aside className="flex min-h-screen flex-col border-study-600 bg-study-800/95 lg:border-r">
				<div className="border-study-600 border-b px-5 py-5">
					<Button onClick={() => router.push("/")} size="sm" variant="ghost">
						<ArrowLeftToLine aria-hidden="true" className="h-4 w-4" />
						项目列表
					</Button>
					<div className="mt-4">
						<VolumeLabel>Volume VI · Project Ledger</VolumeLabel>
						<h1 className="mt-2 font-display text-2xl text-ink leading-tight">
							{project?.title ?? "未命名"}
						</h1>
						{project?.genre && (
							<Badge className="mt-3" tone="brass">
								{project.genre}
							</Badge>
						)}
					</div>

					<div className="mt-5 grid grid-cols-2 gap-2">
						{workspaceModes.map((mode) => (
							<button
								className={`rounded border px-3 py-2 text-xs transition-all duration-300 ${
									workspaceMode === mode.id
										? "brass-gradient"
										: "border-study-600 bg-study-700/50 text-ink-muted hover:border-amber/40 hover:text-ink"
								}`}
								key={mode.id}
								onClick={() => onWorkspaceModeChange(mode.id)}
								type="button"
							>
								{mode.label}
							</button>
						))}
					</div>
				</div>

				<div className="flex min-h-0 flex-1 flex-col">
					<div className="flex items-center justify-between px-5 py-4">
						<h2 className="font-label text-[10px] text-ink-muted uppercase tracking-[0.28em]">
							章节
						</h2>
						<div className="flex gap-2">
							<Button
								aria-label="导入文本"
								onClick={() => setShowImportDialog(true)}
								size="icon"
								type="button"
								variant="quiet"
							>
								<Import aria-hidden="true" className="h-4 w-4" />
							</Button>
							<Button
								aria-label="导出文本"
								onClick={() => handleExport()}
								size="icon"
								type="button"
								variant="quiet"
							>
								<Download aria-hidden="true" className="h-4 w-4" />
							</Button>
							<Button
								aria-label="新建章节"
								onClick={() => setShowCreateChapter(!showCreateChapter)}
								size="icon"
								type="button"
								variant="quiet"
							>
								<Plus aria-hidden="true" className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{showCreateChapter && (
						<Card className="mx-4 mb-3 p-3">
							<input
								className="w-full rounded border border-study-600 bg-study-700/70 px-3 py-2 font-sans text-ink text-sm placeholder:text-ink-dim/70 focus:border-amber focus:outline-none"
								onChange={(e) => setNewChapterTitle(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreateChapter();
									if (e.key === "Escape") setShowCreateChapter(false);
								}}
								placeholder="章节标题..."
								type="text"
								value={newChapterTitle}
							/>
							<div className="mt-3 flex gap-2">
								<Button
									disabled={!newChapterTitle.trim() || createChapter.isPending}
									onClick={handleCreateChapter}
									size="sm"
									type="button"
								>
									{createChapter.isPending ? "创建中..." : "创建"}
								</Button>
								<Button
									onClick={() => setShowCreateChapter(false)}
									size="sm"
									type="button"
									variant="quiet"
								>
									取消
								</Button>
							</div>
						</Card>
					)}

					<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
						{chapters.length === 0 && !showCreateChapter && (
							<div className="px-3 py-8 text-center">
								<p className="text-ink-dim text-sm italic">
									暂无章节，开始你的故事。
								</p>
							</div>
						)}
						<div className="space-y-2">
							{chapters.map((chapter) => {
								const isSelected = chapter.id === selectedChapterId;
								return (
									<button
										className={`group flex w-full items-start gap-3 rounded border px-3 py-3 text-left transition-all duration-300 ${
											isSelected
												? "border-amber/60 bg-amber/10"
												: "border-transparent bg-study-800/60 hover:border-study-500 hover:bg-study-700/60"
										}`}
										key={chapter.id}
										onClick={() => {
											onSelectChapter(chapter.id);
											onWorkspaceModeChange("chapters");
										}}
										type="button"
									>
										<span className="mt-0.5 font-mono text-ink-dim text-xs">
											{chapter.order}
										</span>
										<div className="min-w-0 flex-1">
											<p
												className={`truncate text-sm ${isSelected ? "text-ink" : "text-ink-muted"}`}
											>
												{chapter.title || `第${chapter.order}章`}
											</p>
											<div className="mt-1 flex items-center gap-2">
												{statusDot(chapter.status)}
												<span className="font-mono text-ink-dim text-xs">
													{chapter.wordCount} 字
												</span>
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</div>

					<div className="border-study-600 border-t px-5 py-4">
						<h2 className="mb-3 font-label text-[10px] text-ink-muted uppercase tracking-[0.28em]">
							AI 对话
						</h2>
						<div className="max-h-[220px] space-y-2 overflow-y-auto">
							{sessions.length === 0 && (
								<p className="py-4 text-center text-ink-dim text-xs italic">
									暂无对话
								</p>
							)}
							{sessions.map((session) => {
								const isActive = session.id === activeSessionId;
								return (
									<button
										className={`flex w-full flex-col gap-1 rounded border px-3 py-2 text-left transition-all duration-300 ${
											isActive
												? "border-amber/60 bg-amber/10"
												: "border-study-600 bg-study-700/40 hover:border-study-500 hover:bg-study-700/70"
										}`}
										key={session.id}
										onClick={() => onSelectSession(session.id)}
										type="button"
									>
										<span className="truncate font-sans text-ink-muted text-xs">
											{session.title ?? "未命名对话"}
										</span>
										<span className="font-mono text-[10px] text-ink-dim">
											{new Date(session.updatedAt).toLocaleDateString()}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				</div>
			</aside>

			{showImportDialog && (
				<ImportChaptersDialog
					onClose={() => setShowImportDialog(false)}
					projectId={projectId}
				/>
			)}
		</>
	);
}
