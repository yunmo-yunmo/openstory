import assert from "node:assert/strict";
import test from "node:test";
import {
	parseStreamingChatRequest,
	StreamingSessionError,
} from "./streaming-request";

test("parseStreamingChatRequest rejects malformed JSON with a bad request error", async () => {
	await assert.rejects(
		parseStreamingChatRequest(
			new Request("http://localhost/api/chat/stream", {
				body: "{",
				method: "POST",
			}),
		),
		(error: unknown) =>
			error instanceof StreamingSessionError &&
			error.status === 400 &&
			error.message === "Invalid JSON body",
	);
});

test("parseStreamingChatRequest rejects missing required fields", async () => {
	await assert.rejects(
		parseStreamingChatRequest(
			new Request("http://localhost/api/chat/stream", {
				body: JSON.stringify({ messages: [] }),
				method: "POST",
			}),
		),
		(error: unknown) =>
			error instanceof StreamingSessionError &&
			error.status === 400 &&
			error.message === "Missing required fields",
	);
});

test("parseStreamingChatRequest accepts valid streaming chat input", async () => {
	const body = await parseStreamingChatRequest(
		new Request("http://localhost/api/chat/stream", {
			body: JSON.stringify({
				message: "hello",
				projectId: "project-1",
				sessionId: "session-1",
			}),
			method: "POST",
		}),
	);

	assert.deepEqual(body, {
		message: "hello",
		projectId: "project-1",
		sessionId: "session-1",
	});
});
