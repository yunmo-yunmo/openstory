"use client";

import { useState } from "react";
import { ChapterEditorArea } from "./chapter-editor-area";
import { ChatPanel } from "./chat-panel";
import { ModelServiceDialog } from "./model-service-dialog";
import { ProjectSidebar } from "./project-sidebar";

export function WorkspaceShell({ projectId }: { projectId: string }) {
	const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
		null,
	);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [showModelServices, setShowModelServices] = useState(false);

	return (
		<div className="flex h-screen bg-study-900">
			<ProjectSidebar
				activeSessionId={activeSessionId}
				onSelectChapter={setSelectedChapterId}
				onSelectSession={setActiveSessionId}
				projectId={projectId}
				selectedChapterId={selectedChapterId}
			/>
			<ChapterEditorArea chapterId={selectedChapterId} projectId={projectId} />
			<ChatPanel
				activeSessionId={activeSessionId}
				chapterId={selectedChapterId}
				onOpenModelServices={() => setShowModelServices(true)}
				onSessionChange={setActiveSessionId}
				projectId={projectId}
			/>

			{showModelServices && (
				<ModelServiceDialog onClose={() => setShowModelServices(false)} />
			)}
		</div>
	);
}
