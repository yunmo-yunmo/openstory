export function nextStateForChapterSelection({
	chapterId,
}: {
	chapterId: string;
	activeSessionId: string | null;
}) {
	return {
		selectedChapterId: chapterId,
		activeSessionId: null,
	};
}

export function nextStateForSessionSelection({
	sessionId,
	sessionChapterId,
	currentChapterId,
}: {
	sessionId: string;
	sessionChapterId: string | null;
	currentChapterId: string | null;
}) {
	return {
		activeSessionId: sessionId,
		selectedChapterId: sessionChapterId ?? currentChapterId,
	};
}
