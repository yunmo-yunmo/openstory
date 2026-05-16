import "server-only";

import type { PrismaClient } from "@prisma/client";
import type { ModelMessage, ToolSet } from "ai";
import {
	AI_OPERATION_LABELS,
	type AIOperation,
} from "../../app/_components/story-bible-types";
import { createLLMClient as defaultCreateLLMClient } from "../llm/client";
import type { TaskType } from "../llm/types";
import { assembleContext as defaultAssembleContext } from "./context-manager";
import { createToolRegistry as defaultCreateToolRegistry } from "./tools/registry";

export const MINIMAL_SYSTEM_PROMPT =
	"You are an AI writing assistant for a novel project. " +
	"Your role is to help the author write, edit, and plan their novel. " +
	"You can read chapters, search the text, check consistency, " +
	"update outlines, generate summaries, and write text. " +
	"Always be constructive and specific in your feedback. " +
	"When suggesting text, match the author's style and tone.";

type LLMClient = ReturnType<typeof defaultCreateLLMClient>;
type SessionToolLLMClient = Partial<ChatTurnLLMClient>;

export interface StoredSessionMessage {
	role: string;
	content: string;
	[key: string]: unknown;
}

export interface SelectionContext {
	selectedText: string;
	beforeContext: string;
	afterContext: string;
	operation: AIOperation;
}

export interface ChatTurnLLMClient {
	generate(params: {
		task: TaskType;
		messages: ModelMessage[];
		tools?: ToolSet;
		maxTokens?: number;
		temperature?: number;
	}): Promise<{
		text?: string;
		toolCalls?: unknown[];
		toolResults?: unknown[];
	}>;
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
	generateObject: LLMClient["generateObject"];
}

export interface ChatTurnDependencies {
	assembleContext?: typeof defaultAssembleContext;
	createLLMClient?: (opts: { db: PrismaClient; userId: string }) => {
		generate?: ChatTurnLLMClient["generate"];
		stream?: ChatTurnLLMClient["stream"];
		generateObject?: ChatTurnLLMClient["generateObject"];
	};
	createToolRegistry?: (opts: {
		db: PrismaClient;
		projectId: string;
		llmClient: SessionToolLLMClient;
	}) => ToolSet;
}

export function parseStoredSessionMessages(
	raw: string,
): StoredSessionMessage[] {
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

export function buildUserSessionMessage(opts: {
	message: string;
	selectionContext?: SelectionContext;
}) {
	if (!opts.selectionContext) {
		return { role: "user" as const, content: opts.message };
	}

	const selection = opts.selectionContext;
	return {
		role: "user" as const,
		content: `${AI_OPERATION_LABELS[selection.operation]}${
			selection.operation === "continue" ? "" : "选中的文字"
		}：${selection.selectedText}`,
	};
}

export async function buildSessionContextMessages(opts: {
	db: PrismaClient;
	projectId: string;
	chapterId: string | null;
	dependencies?: Pick<ChatTurnDependencies, "assembleContext">;
}) {
	if (!opts.chapterId) {
		return [{ role: "system" as const, content: MINIMAL_SYSTEM_PROMPT }];
	}

	const assembleContext =
		opts.dependencies?.assembleContext ?? defaultAssembleContext;
	return assembleContext({
		db: opts.db,
		projectId: opts.projectId,
		currentChapterId: opts.chapterId,
	});
}

export function createSessionLLMClient(opts: {
	db: PrismaClient;
	userId: string;
	dependencies?: Pick<ChatTurnDependencies, "createLLMClient">;
}) {
	const createLLMClient =
		opts.dependencies?.createLLMClient ?? defaultCreateLLMClient;
	return createLLMClient({ db: opts.db, userId: opts.userId });
}

export function createSessionTools(opts: {
	db: PrismaClient;
	projectId: string;
	llmClient: SessionToolLLMClient;
	dependencies?: Pick<ChatTurnDependencies, "createToolRegistry">;
}) {
	const createToolRegistry =
		opts.dependencies?.createToolRegistry ??
		((args: {
			db: PrismaClient;
			projectId: string;
			llmClient: SessionToolLLMClient;
		}) =>
			defaultCreateToolRegistry({
				...args,
				llmClient: args.llmClient as LLMClient,
			}));

	return createToolRegistry({
		db: opts.db,
		projectId: opts.projectId,
		llmClient: opts.llmClient,
	});
}

export async function appendSessionMessages(opts: {
	db: PrismaClient;
	userId: string;
	sessionId: string;
	titleSeed: string;
	messages: StoredSessionMessage[];
}) {
	return opts.db.$transaction(async (tx) => {
		const current = await tx.aISession.findFirst({
			where: {
				id: opts.sessionId,
				project: { userId: opts.userId },
			},
		});
		if (!current) return null;

		const currentMessages = parseStoredSessionMessages(current.messages);
		currentMessages.push(...opts.messages);

		const data: { messages: string; title?: string } = {
			messages: JSON.stringify(currentMessages),
		};
		if (!current.title) {
			data.title = opts.titleSeed.slice(0, 100);
		}

		return tx.aISession.update({
			where: { id: opts.sessionId },
			data,
		});
	});
}
