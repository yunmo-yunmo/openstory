import type { ModelMessage } from "ai";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { createLLMClient } from "~/server/llm/client";

export async function POST(request: Request) {
	const session = await auth();
	if (!session?.user?.id) {
		return new Response("Unauthorized", { status: 401 });
	}

	const body = (await request.json()) as {
		messages: ModelMessage[];
		sessionId: string;
		projectId: string;
	};
	const { messages, sessionId, projectId } = body;

	if (!messages || !sessionId || !projectId) {
		return new Response("Missing required fields", { status: 400 });
	}

	const aiSession = await db.aISession.findFirst({
		where: {
			id: sessionId,
			project: { userId: session.user.id },
		},
	});

	if (!aiSession) {
		return new Response("Session not found", { status: 404 });
	}

	try {
		const llmClient = createLLMClient({ db, userId: session.user.id });
		const result = await llmClient.stream({
			task: "chat",
			messages,
			maxTokens: 4096,
			temperature: 0.7,
		});

		const userContent =
			messages.length > 0
				? (messages[messages.length - 1] as ModelMessage)
				: null;
		const userMessage =
			userContent &&
			typeof userContent === "object" &&
			"content" in userContent
				? { role: "user", content: String(userContent.content) }
				: null;

		let fullText = "";
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				try {
					for await (const chunk of result.textStream) {
						fullText += chunk;
						controller.enqueue(encoder.encode(chunk));
					}
				} finally {
					controller.close();
					if (fullText && userMessage) {
						try {
							const current = await db.aISession.findFirst({
								where: {
									id: sessionId,
									project: { userId: session.user.id },
								},
							});
							if (current) {
								let currentMessages: { role: string; content: string }[];
								try {
									currentMessages = JSON.parse(current.messages) as {
										role: string;
										content: string;
									}[];
								} catch {
									currentMessages = [];
								}
								currentMessages.push(userMessage);
								currentMessages.push({
									role: "assistant",
									content: fullText,
								});
								await db.aISession.update({
									where: { id: sessionId },
									data: { messages: JSON.stringify(currentMessages) },
								});
							}
						} catch (e) {
							console.error("[stream] failed to persist messages:", e);
						}
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
		console.error("[stream] AI generation failed:", error);
		return new Response("AI generation failed", { status: 500 });
	}
}
