"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	countWords,
	plainTextToTipTap,
	tiptapToPlainText,
} from "~/server/services/tiptap-converter";
import { api } from "~/trpc/react";

function statusBadge(status: string) {
	const colors: Record<string, string> = {
		draft: "border-sage/40 text-sage bg-sage/10",
		review: "border-amber/40 text-amber bg-amber/10",
		complete: "border-ink-dim/40 text-ink-dim bg-ink-dim/10",
	};
	const labels: Record<string, string> = {
		draft: "草稿",
		review: "审阅",
		complete: "完成",
	};
	return (
		<span
			className={`inline-block rounded-sm border px-2 py-0.5 font-sans text-xs ${colors[status] ?? colors.draft}`}
		>
			{labels[status] ?? status}
		</span>
	);
}

export function ChapterEditorArea({
	projectId,
	chapterId,
}: {
	projectId: string;
	chapterId: string | null;
}) {
	if (!chapterId) {
		return (
			<main className="flex flex-1 flex-col items-center justify-center bg-study-900 px-8">
				<div className="flex flex-col items-center gap-6 text-center">
					{/* Quill icon */}
					<div className="flex h-24 w-24 items-center justify-center rounded-full border border-study-600 bg-study-800/50">
						<svg
							aria-hidden="true"
							className="h-12 w-12 text-amber/40"
							fill="none"
							stroke="currentColor"
							strokeWidth={1}
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>

					<div>
						<h2 className="font-display text-2xl text-ink-muted">
							选择或新建一个章节
						</h2>
						<p className="mt-2 font-sans text-ink-dim text-sm">文字等待落笔</p>
					</div>

					{/* Decorative amber rule */}
					<div className="flex w-48 items-center gap-3">
						<div className="h-px flex-1 bg-gradient-to-r from-transparent via-study-600 to-study-600" />
						<div className="h-0.5 w-8 rounded-full bg-amber/40" />
						<div className="h-px flex-1 bg-gradient-to-l from-transparent via-study-600 to-study-600" />
					</div>
				</div>
			</main>
		);
	}

	return <ChapterEditorAreaInner chapterId={chapterId} projectId={projectId} />;
}

function ChapterEditorAreaInner({
	projectId,
	chapterId,
}: {
	projectId: string;
	chapterId: string;
}) {
	const utils = api.useUtils();

	const [chapterData] = api.chapter.getById.useSuspenseQuery({
		id: chapterId,
	});

	const [content, setContent] = useState("");
	const [title, setTitle] = useState("");
	const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
		"idle",
	);
	const [lastSaved, setLastSaved] = useState<string | null>(null);

	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const contentRef = useRef(content);
	const titleRef = useRef(title);

	// Keep refs in sync
	contentRef.current = content;
	titleRef.current = title;

	const saveMutation = api.chapter.save.useMutation({
		onSuccess: () => {
			setSaveState("saved");
			setLastSaved(new Date().toLocaleTimeString());
			void utils.chapter.listByProject.invalidate({ projectId });
		},
		onError: () => {
			setSaveState("idle");
		},
	});

	// Initialize content when chapter data loads
	useEffect(() => {
		if (chapterData) {
			const text = tiptapToPlainText(chapterData.content);
			setContent(text);
			setTitle(chapterData.title);
			setSaveState("idle");
			setLastSaved(null);
		}
	}, [chapterData]);

	const doSave = useCallback(() => {
		setSaveState("saving");
		const tipTapContent = plainTextToTipTap(contentRef.current);
		saveMutation.mutate({
			id: chapterId,
			content: tipTapContent,
			title: titleRef.current,
		});
	}, [chapterId, saveMutation]);

	// Debounced auto-save: 2 seconds after typing stops
	const scheduleSave = useCallback(() => {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		setSaveState("idle");
		saveTimerRef.current = setTimeout(() => {
			doSave();
		}, 2000);
	}, [doSave]);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}
		};
	}, []);

	const wc = countWords(content);

	return (
		<main className="flex flex-1 flex-col bg-study-900">
			{/* Header bar */}
			<div className="flex shrink-0 items-center gap-4 border-study-600 border-b px-6 py-3">
				{/* Editable title */}
				<input
					className="min-w-0 flex-1 bg-transparent font-display text-ink text-lg placeholder:text-ink-dim focus:outline-none"
					onChange={(e) => {
						setTitle(e.target.value);
						scheduleSave();
					}}
					placeholder="章节标题..."
					type="text"
					value={title}
				/>

				{/* Status badge */}
				{chapterData && statusBadge(chapterData.status)}

				{/* Save indicator */}
				<div className="flex items-center gap-1.5 font-mono text-ink-dim text-xs">
					{saveState === "saving" && (
						<span className="text-amber">保存中...</span>
					)}
					{saveState === "saved" && <span className="text-sage">已保存</span>}
					{saveState === "idle" && lastSaved && <span>已保存 {lastSaved}</span>}
				</div>
			</div>

			{/* Editor area */}
			<div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6">
				<div className="editor-surface flex w-full max-w-[720px] flex-1 flex-col overflow-hidden">
					<textarea
						className="h-full w-full resize-none bg-transparent p-12 font-sans text-lg text-paper-800 leading-relaxed placeholder:text-paper-200 focus:outline-none"
						onChange={(e) => {
							setContent(e.target.value);
							scheduleSave();
						}}
						placeholder="开始写作..."
						value={content}
					/>
					{/* Floating word count */}
					<div className="flex justify-end px-6 pb-3">
						<span className="font-mono text-ink-dim/60 text-xs">
							{wc.toLocaleString()} {wc === 1 ? "字" : "字"}
						</span>
					</div>
				</div>
			</div>
		</main>
	);
}
