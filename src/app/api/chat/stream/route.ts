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

		return result.toTextStreamResponse();
	} catch (error) {
		console.error("[stream] AI generation failed:", error);
		return new Response("AI generation failed", { status: 500 });
	}
}
