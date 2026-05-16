import "server-only";

import type { PrismaClient } from "@prisma/client";
import type { ModelMessage, ToolSet } from "ai";
import { hasRevisionEditIntent } from "../../app/_components/story-bible-types";
import type { TaskType } from "../llm/types";
import type { assembleContext as defaultAssembleContext } from "./context-manager";
import {
	appendSessionMessages,
	buildSessionContextMessages,
	buildUserSessionMessage,
	createSessionLLMClient,
	createSessionTools,
	readSessionMessages,
	type StoredSessionMessage,
} from "./session-turn";

export class StreamingSessionError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "StreamingSessionError";
	}
}

interface StreamingLLMClient {
	stream(params: {
		task: TaskType;
		messages: ModelMessage[];
		tools?: ToolSet;
		maxTokens?: number;
		temperature?: number;
	}): Promise<{
		textStream: AsyncIterable<string>;
		toolCalls?: PromiseLike<unknown[]>;
		toolResults?: PromiseLike<unknown[]>;
	}>;
}

interface StreamingSessionDependencies {
	assembleContext?: typeof defaultAssembleContext;
	createLLMClient?: (opts: { db: PrismaClient; userId: string }) => {
		stream: StreamingLLMClient["stream"];
	};
	createToolRegistry?: (opts: {
		db: PrismaClient;
		projectId: string;
		llmClient: StreamingLLMClient;
	}) => ToolSet;
}

async function resolveToolMetadata(
	result: Awaited<ReturnType<StreamingLLMClient["stream"]>>,
) {
	const [toolCalls, toolResults] = await Promise.all([
		result.toolCalls ?? Promise.resolve([]),
		result.toolResults ?? Promise.resolve([]),
	]);

	return {
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		toolResults: toolResults.length > 0 ? toolResults : undefined,
	};
}

export async function startStreamingSessionChat(opts: {
	db: PrismaClient;
	userId: string;
	sessionId: string;
	projectId: string;
	message: string;
	dependencies?: StreamingSessionDependencies;
}) {
	if (hasRevisionEditIntent(opts.message)) {
		throw new StreamingSessionError("Non-streaming required", 409);
	}

	const aiSession = await opts.db.aISession.findFirst({
		where: {
			id: opts.sessionId,
			project: { userId: opts.userId },
		},
	});

	if (!aiSession) {
		throw new StreamingSessionError("Session not found", 404);
	}

	if (aiSession.projectId !== opts.projectId) {
		throw new StreamingSessionError("Session project mismatch", 400);
	}

	const userMessage = buildUserSessionMessage({ message: opts.message });
	const storedMessages = await readSessionMessages({
		db: opts.db,
		sessionId: aiSession.id,
		legacyMessages: aiSession.messages,
	});
	const contextMessages = await buildSessionContextMessages({
		db: opts.db,
		projectId: aiSession.projectId,
		chapterId: aiSession.chapterId,
		dependencies: opts.dependencies,
	});

	const llmClient = createSessionLLMClient({
		db: opts.db,
		userId: opts.userId,
		dependencies: opts.dependencies,
	});
	if (!llmClient.stream) {
		throw new StreamingSessionError("Streaming unavailable", 500);
	}
	const tools = createSessionTools({
		db: opts.db,
		projectId: aiSession.projectId,
		llmClient,
		dependencies: opts.dependencies?.createToolRegistry
			? {
					createToolRegistry: (args) =>
						opts.dependencies?.createToolRegistry?.({
							...args,
							llmClient: args.llmClient as StreamingLLMClient,
						}) ?? {},
				}
			: undefined,
	});

	const result = await llmClient.stream({
		task: "chat",
		messages: [
			...contextMessages,
			...(storedMessages as ModelMessage[]),
			userMessage,
		],
		tools,
		maxTokens: 4096,
		temperature: 0.7,
	});

	return {
		textStream: result.textStream,
		persist: async (assistantText: string) => {
			if (!assistantText) return;

			const toolMetadata = await resolveToolMetadata(result);
			const assistantMessage: StoredSessionMessage = {
				role: "assistant",
				content: assistantText,
				...(toolMetadata.toolCalls
					? { toolCalls: toolMetadata.toolCalls }
					: {}),
				...(toolMetadata.toolResults
					? { toolResults: toolMetadata.toolResults }
					: {}),
			};

			await appendSessionMessages({
				db: opts.db,
				userId: opts.userId,
				sessionId: opts.sessionId,
				titleSeed: userMessage.content,
				messages: [userMessage, assistantMessage],
			});
		},
	};
}
