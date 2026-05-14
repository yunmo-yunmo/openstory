"use client";

import { useCallback, useState } from "react";
import { api } from "~/trpc/react";
import { ChapterEditorArea } from "./chapter-editor-area";
import { CharactersPanel } from "./characters-panel";
import { ChatPanel } from "./chat-panel";
import type { DiffProposal } from "./extensions/inline-diff";
import type { SelectionData } from "./extensions/selection-trigger";
import { ModelServiceDialog } from "./model-service-dialog";
import { OutlinePanel } from "./outline-panel";
import { ProjectSidebar } from "./project-sidebar";
import type { AIOperation } from "./selection-menu";
import { SelectionMenu } from "./selection-menu";
import type { WorkspaceMode } from "./story-bible-types";
import {
	nextStateForChapterSelection,
	nextStateForSessionSelection,
} from "./workspace-shell-helpers";
import { WorldNotesPanel } from "./world-notes-panel";

export function WorkspaceShell({ projectId }: { projectId: string }) {
	const utils = api.useUtils();

	const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
		null,
	);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [showModelServices, setShowModelServices] = useState(false);
	const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("chapters");
	const [editorProposals, setEditorProposals] = useState<DiffProposal[]>([]);
	const [mutatingProposalId, setMutatingProposalId] = useState<string | null>(
		null,
	);
	const [selectionData, setSelectionData] = useState<SelectionData | null>(
		null,
	);
	const [selectionPosition, setSelectionPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const [pendingSelection, setPendingSelection] = useState<{
		operation: AIOperation;
		selection: SelectionData;
	} | null>(null);

	const acceptMutation = api.revisionProposal.accept.useMutation({
		onSuccess: () => {
			setMutatingProposalId(null);
			if (activeSessionId) {
				void utils.revisionProposal.listBySession.invalidate({
					sessionId: activeSessionId,
				});
				void utils.session.getById.invalidate({ id: activeSessionId });
			}
			void utils.chapter.listByProject.invalidate({ projectId });
			if (selectedChapterId) {
				void utils.chapter.getById.invalidate({ id: selectedChapterId });
			}
		},
		onError: () => {
			setMutatingProposalId(null);
		},
	});

	const rejectMutation = api.revisionProposal.reject.useMutation({
		onSuccess: () => {
			setMutatingProposalId(null);
			if (activeSessionId) {
				void utils.revisionProposal.listBySession.invalidate({
					sessionId: activeSessionId,
				});
				void utils.session.getById.invalidate({ id: activeSessionId });
			}
		},
		onError: () => {
			setMutatingProposalId(null);
		},
	});

	const handleAcceptProposal = useCallback(
		(proposalId: string) => {
			setMutatingProposalId(proposalId);
			acceptMutation.mutate({ id: proposalId });
		},
		[acceptMutation],
	);

	const handleRejectProposal = useCallback(
		(proposalId: string) => {
			setMutatingProposalId(proposalId);
			rejectMutation.mutate({ id: proposalId });
		},
		[rejectMutation],
	);

	const handleProposalsChange = useCallback((proposals: DiffProposal[]) => {
		setEditorProposals(proposals);
	}, []);

	const handleSelectionChange = useCallback(
		(data: SelectionData | null, position?: { top: number; left: number }) => {
			setSelectionData(data);
			setSelectionPosition(position ?? null);
		},
		[],
	);

	const handleSelectionAction = useCallback(
		(operation: AIOperation, selection: SelectionData) => {
			setPendingSelection({ operation, selection });
			setSelectionData(null);
			setSelectionPosition(null);
		},
		[],
	);

	const handleSelectionConsumed = useCallback(() => {
		setPendingSelection(null);
	}, []);

	const handleSelectChapter = useCallback(
		(chapterId: string) => {
			const next = nextStateForChapterSelection({
				chapterId,
				activeSessionId,
			});
			setSelectedChapterId(next.selectedChapterId);
			setActiveSessionId(next.activeSessionId);
			setEditorProposals([]);
		},
		[activeSessionId],
	);

	const handleSelectSession = useCallback(
		(sessionId: string, sessionChapterId: string | null) => {
			const next = nextStateForSessionSelection({
				sessionId,
				sessionChapterId,
				currentChapterId: selectedChapterId,
			});
			setActiveSessionId(next.activeSessionId);
			setSelectedChapterId(next.selectedChapterId);
			setEditorProposals([]);
			setWorkspaceMode("chapters");
		},
		[selectedChapterId],
	);

	const centerPanel =
		workspaceMode === "characters" ? (
			<CharactersPanel projectId={projectId} />
		) : workspaceMode === "outline" ? (
			<OutlinePanel projectId={projectId} />
		) : workspaceMode === "worldNotes" ? (
			<WorldNotesPanel projectId={projectId} />
		) : (
			<ChapterEditorArea
				chapterId={selectedChapterId}
				isAcceptingProposal={
					mutatingProposalId !== null && acceptMutation.isPending
				}
				isRejectingProposal={
					mutatingProposalId !== null && rejectMutation.isPending
				}
				onAcceptProposal={handleAcceptProposal}
				onRejectProposal={handleRejectProposal}
				onSelectionChange={handleSelectionChange}
				projectId={projectId}
				proposals={editorProposals}
			/>
		);

	return (
		<div className="flex min-h-screen flex-col bg-study-900 lg:grid lg:grid-cols-[280px_minmax(0,1fr)_380px]">
			<ProjectSidebar
				activeSessionId={activeSessionId}
				onSelectChapter={handleSelectChapter}
				onSelectSession={handleSelectSession}
				onWorkspaceModeChange={setWorkspaceMode}
				projectId={projectId}
				selectedChapterId={selectedChapterId}
				workspaceMode={workspaceMode}
			/>
			{centerPanel}
			<ChatPanel
				activeSessionId={activeSessionId}
				chapterId={selectedChapterId}
				onOpenModelServices={() => setShowModelServices(true)}
				onProposalsChange={handleProposalsChange}
				onSelectionConsumed={handleSelectionConsumed}
				onSessionChange={setActiveSessionId}
				pendingSelection={pendingSelection}
				projectId={projectId}
			/>

			{selectionData && (
				<SelectionMenu
					onAction={handleSelectionAction}
					position={selectionPosition}
					selection={selectionData}
				/>
			)}

			{showModelServices && (
				<ModelServiceDialog onClose={() => setShowModelServices(false)} />
			)}
		</div>
	);
}
