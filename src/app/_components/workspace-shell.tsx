"use client";

import { useCallback, useState } from "react";
import { ChapterEditorArea } from "./chapter-editor-area";
import { CharactersPanel } from "./characters-panel";
import { ChatPanel } from "./chat-panel";
import type { DiffProposal } from "./extensions/inline-diff";
import { ModelServiceDialog } from "./model-service-dialog";
import { OutlinePanel } from "./outline-panel";
import { ProjectSidebar } from "./project-sidebar";
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

	const handleProposalsChange = useCallback((proposals: DiffProposal[]) => {
		setEditorProposals(proposals);
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
				onSessionChange={setActiveSessionId}
				projectId={projectId}
			/>

			{showModelServices && (
				<ModelServiceDialog onClose={() => setShowModelServices(false)} />
			)}
		</div>
	);
}
