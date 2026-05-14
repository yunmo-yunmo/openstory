import assert from "node:assert/strict";
import test from "node:test";

import {
	nextStateForChapterSelection,
	nextStateForSessionSelection,
} from "./workspace-shell-helpers";

test("selecting a chapter clears the active session to avoid chapter/session mismatch", () => {
	assert.deepEqual(
		nextStateForChapterSelection({
			chapterId: "chapter-b",
			activeSessionId: "session-a",
		}),
		{
			selectedChapterId: "chapter-b",
			activeSessionId: null,
		},
	);
});

test("selecting a session also selects the session chapter", () => {
	assert.deepEqual(
		nextStateForSessionSelection({
			sessionId: "session-a",
			sessionChapterId: "chapter-a",
		}),
		{
			activeSessionId: "session-a",
			selectedChapterId: "chapter-a",
		},
	);
});

test("selecting an unbound session keeps the current chapter visible", () => {
	assert.deepEqual(
		nextStateForSessionSelection({
			sessionId: "session-a",
			sessionChapterId: null,
		}),
		{
			activeSessionId: "session-a",
			selectedChapterId: null,
		},
	);
});
