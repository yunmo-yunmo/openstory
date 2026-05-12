"use client";

import { useCallback, useState } from "react";
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
import { WorldNotesPanel } from "./world-notes-panel";

export function WorkspaceShell({ projectId }: { projectId: string }) {
	const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
		null,
	);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [showModelServices, setShowModelServices] = useState(false);
	const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("chapters");
	const [editorProposals, setEditorProposals] = useState<DiffProposal[]>([]);
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
				onSelectionChange={handleSelectionChange}
				projectId={projectId}
				proposals={editorProposals}
			/>
		);

	return (
		<div className="flex h-screen bg-study-900">
			<ProjectSidebar
				activeSessionId={activeSessionId}
				onSelectChapter={setSelectedChapterId}
				onSelectSession={setActiveSessionId}
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
