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
}: {
	sessionId: string;
	sessionChapterId: string | null;
}) {
	return {
		activeSessionId: sessionId,
		selectedChapterId: sessionChapterId,
	};
}
