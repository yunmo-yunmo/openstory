import { parseStreamingChatRequest } from "~/server/ai/streaming-request";
import {
	StreamingSessionError,
	startStreamingSessionChat,
} from "~/server/ai/streaming-session";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function POST(request: Request) {
	const session = await auth();
	if (!session?.user?.id) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const { message, sessionId, projectId } =
			await parseStreamingChatRequest(request);
		const streamingChat = await startStreamingSessionChat({
			db,
			userId: session.user.id,
			sessionId,
			projectId,
			message,
		});

		let fullText = "";
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				try {
					for await (const chunk of streamingChat.textStream) {
						fullText += chunk;
						controller.enqueue(encoder.encode(chunk));
					}
				} finally {
					controller.close();
					try {
						await streamingChat.persist(fullText);
					} catch (e) {
						console.error("[stream] failed to persist messages:", e);
					}
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		if (error instanceof StreamingSessionError) {
			return new Response(error.message, { status: error.status });
		}
		console.error("[stream] AI generation failed:", error);
		return new Response("AI generation failed", { status: 500 });
	}
}
