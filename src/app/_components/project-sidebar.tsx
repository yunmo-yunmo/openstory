"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import { ImportChaptersDialog } from "./import-chapters-dialog";
import type { WorkspaceMode } from "./story-bible-types";
import { workspaceModes } from "./story-bible-types";

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
			<aside className="flex w-[280px] shrink-0 flex-col border-study-600 border-r bg-study-800">
				{/* Project header */}
				<div className="shrink-0 border-study-600 border-b px-4 py-5">
					<button
						className="group flex w-full items-center gap-2 text-left"
						onClick={() => router.push("/")}
						type="button"
					>
						<svg
							aria-hidden="true"
							className="h-4 w-4 shrink-0 text-ink-dim transition-colors group-hover:text-amber"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M19 12H5m7-7l-7 7 7 7"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<span className="font-sans text-ink-dim text-xs transition-colors group-hover:text-ink-muted">
							项目列表
						</span>
					</button>
					<h1 className="mt-3 font-display text-ink text-lg leading-snug">
						{project?.title ?? "未命名"}
					</h1>
					{project?.genre && (
						<span className="mt-2 inline-block rounded-sm border border-study-500 px-2 py-0.5 font-sans text-ink-muted text-xs">
							{project.genre}
						</span>
					)}
					<div className="mt-4 grid grid-cols-2 gap-1">
						{workspaceModes.map((mode) => (
							<button
								className={`rounded-sm border px-2 py-1.5 font-sans text-xs transition-colors ${
									workspaceMode === mode.id
										? "border-amber/60 bg-amber/15 text-amber"
										: "border-study-600 bg-study-700/60 text-ink-dim hover:border-study-500 hover:text-ink-muted"
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

				{/* Chapters section */}
				<div className="flex min-h-0 flex-1 flex-col">
					<div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
						<h2 className="font-sans font-semibold text-ink-dim text-xs uppercase tracking-wider">
							章节
						</h2>
						<div className="flex gap-1">
							<button
								aria-label="导入文本"
								className="flex h-6 w-6 items-center justify-center rounded-sm border border-study-600 bg-study-700 text-ink-dim transition-colors hover:border-amber/40 hover:text-amber"
								onClick={() => setShowImportDialog(true)}
								type="button"
							>
								<svg
									aria-hidden="true"
									className="h-3.5 w-3.5"
									fill="none"
									stroke="currentColor"
									strokeWidth={2}
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</button>
							<button
								aria-label="导出文本"
								className="flex h-6 w-6 items-center justify-center rounded-sm border border-study-600 bg-study-700 text-ink-dim transition-colors hover:border-amber/40 hover:text-amber"
								onClick={() => handleExport()}
								type="button"
							>
								<svg
									aria-hidden="true"
									className="h-3.5 w-3.5"
									fill="none"
									stroke="currentColor"
									strokeWidth={2}
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</button>
							<button
								aria-label="新建章节"
								className="flex h-6 w-6 items-center justify-center rounded-sm border border-study-600 bg-study-700 text-ink-dim transition-colors hover:border-amber/40 hover:text-amber"
								onClick={() => setShowCreateChapter(!showCreateChapter)}
								type="button"
							>
								<svg
									aria-hidden="true"
									className="h-3.5 w-3.5"
									fill="none"
									stroke="currentColor"
									strokeWidth={2}
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M12 5v14m-7-7h14"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</button>
						</div>
					</div>

					{/* Inline create-chapter form */}
					{showCreateChapter && (
						<div className="mx-3 mb-2 rounded-sm border border-study-600 bg-study-700/50 p-2">
							<input
								className="w-full bg-transparent px-2 py-1.5 font-sans text-ink text-sm placeholder:text-ink-dim focus:outline-none"
								onChange={(e) => setNewChapterTitle(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreateChapter();
									if (e.key === "Escape") setShowCreateChapter(false);
								}}
								placeholder="章节标题..."
								type="text"
								value={newChapterTitle}
							/>
							<div className="mt-2 flex gap-2">
								<button
									className="rounded-sm bg-amber/20 px-3 py-1 font-sans text-amber text-xs transition-colors hover:bg-amber/30 disabled:opacity-40"
									disabled={!newChapterTitle.trim() || createChapter.isPending}
									onClick={handleCreateChapter}
									type="button"
								>
									{createChapter.isPending ? "创建中..." : "创建"}
								</button>
								<button
									className="rounded-sm px-3 py-1 font-sans text-ink-dim text-xs transition-colors hover:text-ink-muted"
									onClick={() => setShowCreateChapter(false)}
									type="button"
								>
									取消
								</button>
							</div>
						</div>
					)}

					{/* Chapter list */}
					<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
						{chapters.length === 0 && !showCreateChapter && (
							<p className="px-4 py-6 text-center font-sans text-ink-dim text-xs italic">
								暂无章节，开始你的故事。
							</p>
						)}
						{chapters.map((chapter) => {
							const isSelected = chapter.id === selectedChapterId;
							return (
								<button
									className={`group flex w-full items-start gap-3 rounded-sm px-3 py-2.5 text-left transition-colors ${
										isSelected
											? "border-amber border-l-2 bg-amber-glow"
											: "border-transparent border-l-2 hover:bg-study-700/50"
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
											className={`truncate font-sans text-sm leading-snug ${
												isSelected ? "text-ink" : "text-ink-muted"
											}`}
										>
											{chapter.title || `第${chapter.order}章`}
										</p>
										<div className="mt-1 flex items-center gap-2">
											{statusDot(chapter.status)}
											<span className="font-mono text-ink-dim text-xs">
												{chapter.wordCount}字
											</span>
										</div>
									</div>
								</button>
							);
						})}
					</div>
				</div>

				{/* Divider + AI Sessions section */}
				<div className="shrink-0 border-study-600 border-t">
					<div className="px-4 pt-4 pb-2">
						<h2 className="font-sans font-semibold text-ink-dim text-xs uppercase tracking-wider">
							AI 对话
						</h2>
					</div>
					<div className="max-h-[200px] overflow-y-auto px-2 pb-4">
						{sessions.length === 0 && (
							<p className="px-3 py-3 text-center font-sans text-ink-dim text-xs italic">
								暂无对话
							</p>
						)}
						{sessions.map((session) => {
							const isActive = session.id === activeSessionId;
							return (
								<button
									className={`flex w-full flex-col gap-0.5 rounded-sm px-3 py-2 text-left transition-colors ${
										isActive
											? "border-amber border-l-2 bg-amber-glow"
											: "border-transparent border-l-2 hover:bg-study-700/50"
									}`}
									key={session.id}
									onClick={() => onSelectSession(session.id)}
									type="button"
								>
									<span className="truncate font-sans text-ink-muted text-xs">
										{session.title ?? "未命名对话"}
									</span>
									<span className="font-mono text-ink-dim text-xs">
										{new Date(session.updatedAt).toLocaleDateString()}
									</span>
								</button>
							);
						})}
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
