import type { ModelMessage } from "ai";
import { StreamingSessionError } from "./streaming-session";

export { StreamingSessionError };

export interface StreamingChatRequestBody {
	messages: ModelMessage[];
	sessionId: string;
	projectId: string;
}

function isStreamingChatRequestBody(
	body: unknown,
): body is StreamingChatRequestBody {
	return (
		typeof body === "object" &&
		body !== null &&
		"messages" in body &&
		"sessionId" in body &&
		"projectId" in body &&
		Array.isArray(body.messages) &&
		typeof body.sessionId === "string" &&
		body.sessionId.length > 0 &&
		typeof body.projectId === "string" &&
		body.projectId.length > 0
	);
}

export async function parseStreamingChatRequest(
	request: Request,
): Promise<StreamingChatRequestBody> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new StreamingSessionError("Invalid JSON body", 400);
	}

	if (!isStreamingChatRequestBody(body)) {
		throw new StreamingSessionError("Missing required fields", 400);
	}

	return body;
}
