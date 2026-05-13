"use client";

import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BookText, Feather, PencilLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	countWords,
	tiptapToPlainText,
} from "~/server/services/tiptap-converter";
import { api } from "~/trpc/react";
import type { DiffProposal } from "./extensions/inline-diff";
import { createInlineDiffExtension } from "./extensions/inline-diff";
import type { SelectionData } from "./extensions/selection-trigger";
import { createSelectionTriggerExtension } from "./extensions/selection-trigger";
import { InlineDiffToolbar } from "./inline-diff-toolbar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";

function statusBadge(status: string) {
	const tones: Record<string, "sage" | "brass" | "muted"> = {
		draft: "sage",
		review: "brass",
		complete: "muted",
	};
	const labels: Record<string, string> = {
		draft: "草稿",
		review: "审阅",
		complete: "完成",
	};
	return (
		<Badge tone={tones[status] ?? "muted"}>{labels[status] ?? status}</Badge>
	);
}

export function ChapterEditorArea({
	projectId,
	chapterId,
	proposals,
	onAcceptProposal,
	onRejectProposal,
	isAcceptingProposal,
	isRejectingProposal,
	onSelectionChange,
}: {
	projectId: string;
	chapterId: string | null;
	proposals?: DiffProposal[];
	onAcceptProposal?: (id: string) => void;
	onRejectProposal?: (id: string) => void;
	isAcceptingProposal?: boolean;
	isRejectingProposal?: boolean;
	onSelectionChange?: (
		data: SelectionData | null,
		position?: { top: number; left: number },
	) => void;
}) {
	if (!chapterId) {
		return (
			<main className="flex min-h-[60vh] flex-1 items-center justify-center px-6 py-10">
				<EmptyState
					action={
						<Button size="lg" type="button" variant="quiet">
							<PencilLine aria-hidden="true" className="h-4 w-4" />
							选择章节
						</Button>
					}
					description="文字等待落笔。选择一章继续，或新建一个章节开始书写。"
					icon={
						<Feather aria-hidden="true" className="h-9 w-9" strokeWidth={1.5} />
					}
					title="选择或新建一个章节"
					volume="Volume VII · Manuscript Desk"
				/>
			</main>
		);
	}

	return (
		<ChapterEditorAreaInner
			chapterId={chapterId}
			isAcceptingProposal={isAcceptingProposal}
			isRejectingProposal={isRejectingProposal}
			onAcceptProposal={onAcceptProposal}
			onRejectProposal={onRejectProposal}
			onSelectionChange={onSelectionChange}
			projectId={projectId}
			proposals={proposals}
		/>
	);
}

function ChapterEditorAreaInner({
	projectId,
	chapterId,
	proposals,
	onAcceptProposal,
	onRejectProposal,
	isAcceptingProposal,
	isRejectingProposal,
	onSelectionChange,
}: {
	projectId: string;
	chapterId: string;
	proposals?: DiffProposal[];
	onAcceptProposal?: (id: string) => void;
	onRejectProposal?: (id: string) => void;
	isAcceptingProposal?: boolean;
	isRejectingProposal?: boolean;
	onSelectionChange?: (
		data: SelectionData | null,
		position?: { top: number; left: number },
	) => void;
}) {
	const utils = api.useUtils();

	const [chapterData] = api.chapter.getById.useSuspenseQuery({
		id: chapterId,
	});

	const [title, setTitle] = useState("");
	const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
		"idle",
	);
	const [lastSaved, setLastSaved] = useState<string | null>(null);
	const [wordCount, setWordCount] = useState(0);

	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const titleRef = useRef(title);
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

	const doSave = useCallback(
		(editor: Editor) => {
			setSaveState("saving");
			saveMutation.mutate({
				id: chapterId,
				content: JSON.stringify(editor.getJSON()),
				title: titleRef.current,
			});
		},
		[chapterId, saveMutation],
	);

	const scheduleSave = useCallback(
		(editor: Editor) => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}
			setSaveState("idle");
			saveTimerRef.current = setTimeout(() => {
				doSave(editor);
			}, 2000);
		},
		[doSave],
	);

	const selectionTrigger = createSelectionTriggerExtension((data) => {
		if (onSelectionChange) {
			if (data) {
				const view = editor?.view;
				if (view) {
					const { from } = view.state.selection;
					const coords = view.coordsAtPos(from);
					onSelectionChange(data, { top: coords.top, left: coords.left });
				} else {
					onSelectionChange(data);
				}
			} else {
				onSelectionChange(null);
			}
		}
	});

	const proposalStore = useRef({ proposals: proposals ?? [] });
	proposalStore.current.proposals = proposals ?? [];

	const inlineDiffExt = createInlineDiffExtension(proposalStore.current);

	const editor = useEditor({
		extensions: [StarterKit, selectionTrigger, inlineDiffExt],
		content: chapterData?.content ? JSON.parse(chapterData.content) : "",
		immediatelyRender: false,
		onUpdate: ({ editor: updatedEditor }) => {
			const plainText = tiptapToPlainText(
				JSON.stringify(updatedEditor.getJSON()),
			);
			setWordCount(countWords(plainText));
			scheduleSave(updatedEditor);
		},
	});

	useEffect(() => {
		if (editor) {
			editor.view.dispatch(
				editor.view.state.tr.setMeta("inlineDiffUpdate", true),
			);
		}
	}, [editor]);

	useEffect(() => {
		if (chapterData) {
			setTitle(chapterData.title);
			const plainText = tiptapToPlainText(chapterData.content);
			setWordCount(countWords(plainText));
			setSaveState("idle");
			setLastSaved(null);
		}
	}, [chapterData]);

	useEffect(() => {
		if (editor && chapterData?.content) {
			const currentJson = JSON.stringify(editor.getJSON());
			if (currentJson !== chapterData.content) {
				editor.commands.setContent(JSON.parse(chapterData.content));
			}
		}
	}, [editor, chapterData?.content]);

	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}
		};
	}, []);

	return (
		<main className="flex min-w-0 flex-1 flex-col bg-study-900">
			<div className="flex shrink-0 items-center gap-4 border-study-600 border-b px-5 py-4">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					<BookText
						aria-hidden="true"
						className="h-4 w-4 shrink-0 text-amber"
					/>
					<input
						className="min-w-0 flex-1 bg-transparent font-display text-2xl text-ink placeholder:text-ink-dim/70 focus:outline-none"
						onChange={(e) => {
							setTitle(e.target.value);
							if (editor) scheduleSave(editor);
						}}
						placeholder="章节标题..."
						type="text"
						value={title}
					/>
				</div>

				{chapterData && statusBadge(chapterData.status)}

				<div className="hidden items-center gap-2 font-mono text-ink-dim text-xs sm:flex">
					{saveState === "saving" && (
						<span className="text-amber">保存中...</span>
					)}
					{saveState === "saved" && <span className="text-sage">已保存</span>}
					{saveState === "idle" && lastSaved && <span>已保存 {lastSaved}</span>}
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-6 lg:px-6">
				<div className="editor-surface flex w-full max-w-[780px] flex-1 flex-col overflow-hidden">
					<div className="border-paper-200 border-b px-6 py-3 text-right text-ink-dim text-xs">
						{wordCount.toLocaleString()} 字
					</div>
					<div className="min-h-0 flex-1">
						{editor && <EditorContent editor={editor} />}
					</div>
					{proposals && proposals.length > 0 && (
						<div className="border-paper-200 border-t">
							<InlineDiffToolbar
								isAccepting={isAcceptingProposal ?? false}
								isRejecting={isRejectingProposal ?? false}
								onAccept={onAcceptProposal ?? (() => {})}
								onReject={onRejectProposal ?? (() => {})}
								proposals={proposals.filter((p) => p.status === "pending")}
							/>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
