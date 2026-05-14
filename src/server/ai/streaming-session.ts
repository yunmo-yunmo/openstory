import "server-only";

import type { PrismaClient } from "@prisma/client";
import type { ModelMessage, ToolSet } from "ai";
import { createLLMClient as defaultCreateLLMClient } from "../llm/client";
import type { TaskType } from "../llm/types";
import { assembleContext as defaultAssembleContext } from "./context-manager";
import { createToolRegistry as defaultCreateToolRegistry } from "./tools/registry";

const MINIMAL_SYSTEM_PROMPT =
	"You are an AI writing assistant for a novel project. " +
	"Your role is to help the author write, edit, and plan their novel. " +
	"You can read chapters, search the text, check consistency, " +
	"update outlines, generate summaries, and write text. " +
	"Always be constructive and specific in your feedback. " +
	"When suggesting text, match the author's style and tone.";

export class StreamingSessionError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "StreamingSessionError";
	}
}

type LLMClient = ReturnType<typeof defaultCreateLLMClient>;

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

interface StoredSessionMessage {
	role: string;
	content: string;
	[key: string]: unknown;
}

function parseStoredMessages(raw: string): StoredSessionMessage[] {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(message): message is StoredSessionMessage =>
				typeof message === "object" &&
				message !== null &&
				"role" in message &&
				"content" in message &&
				typeof message.role === "string" &&
				typeof message.content === "string",
		);
	} catch {
		return [];
	}
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

function getLatestUserMessage(incomingMessages: ModelMessage[]) {
	const lastMessage = incomingMessages[incomingMessages.length - 1];
	if (!lastMessage || lastMessage.role !== "user") {
		throw new StreamingSessionError("Missing user message", 400);
	}

	return {
		role: "user" as const,
		content:
			typeof lastMessage.content === "string"
				? lastMessage.content
				: JSON.stringify(lastMessage.content),
	};
}

export async function startStreamingSessionChat(opts: {
	db: PrismaClient;
	userId: string;
	sessionId: string;
	projectId: string;
	incomingMessages: ModelMessage[];
	dependencies?: StreamingSessionDependencies;
}) {
	const assembleContext =
		opts.dependencies?.assembleContext ?? defaultAssembleContext;
	const createLLMClient =
		opts.dependencies?.createLLMClient ?? defaultCreateLLMClient;
	const createToolRegistry =
		opts.dependencies?.createToolRegistry ??
		((args: {
			db: PrismaClient;
			projectId: string;
			llmClient: StreamingLLMClient;
		}) =>
			defaultCreateToolRegistry({
				...args,
				llmClient: args.llmClient as LLMClient,
			}));

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

	const userMessage = getLatestUserMessage(opts.incomingMessages);
	const storedMessages = parseStoredMessages(aiSession.messages);
	const contextMessages = aiSession.chapterId
		? await assembleContext({
				db: opts.db,
				projectId: aiSession.projectId,
				currentChapterId: aiSession.chapterId,
			})
		: [{ role: "system" as const, content: MINIMAL_SYSTEM_PROMPT }];

	const llmClient = createLLMClient({ db: opts.db, userId: opts.userId });
	const tools = createToolRegistry({
		db: opts.db,
		projectId: aiSession.projectId,
		llmClient,
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

			await opts.db.$transaction(async (tx) => {
				const current = await tx.aISession.findFirst({
					where: {
						id: opts.sessionId,
						project: { userId: opts.userId },
					},
				});
				if (!current) return;

				const currentMessages = parseStoredMessages(current.messages);
				currentMessages.push(userMessage);
				currentMessages.push(assistantMessage);

				const data: { messages: string; title?: string } = {
					messages: JSON.stringify(currentMessages),
				};
				if (!current.title) {
					data.title = userMessage.content.slice(0, 100);
				}

				await tx.aISession.update({
					where: { id: opts.sessionId },
					data,
				});
			});
		},
	};
}
