import "server-only";

import type { PrismaClient } from "@prisma/client";
import { createLLMClient } from "../../llm/client";
import type { ConsistencyIssue } from "./consistency-agent";
import { checkChapterConsistency } from "./consistency-agent";
import { generateChapterSummary } from "./summary-agent";

export type { ConsistencyIssue };

export interface AgentRunResult {
	summary: string | null;
	consistencyIssues: ConsistencyIssue[];
	errors: string[];
}

export async function runBackgroundAgents(opts: {
	db: PrismaClient;
	userId: string;
	projectId: string;
	chapterId: string;
}): Promise<AgentRunResult> {
	const llmClient = createLLMClient({
		db: opts.db,
		userId: opts.userId,
	});

	const result: AgentRunResult = {
		summary: null,
		consistencyIssues: [],
		errors: [],
	};

	try {
		result.summary = await generateChapterSummary(
			opts.db,
			llmClient,
			opts.chapterId,
			opts.projectId,
		);
	} catch (error) {
		result.errors.push(
			`Summary generation failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	try {
		result.consistencyIssues = await checkChapterConsistency(
			opts.db,
			llmClient,
			opts.chapterId,
			opts.projectId,
		);
	} catch (error) {
		result.errors.push(
			`Consistency check failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	return result;
}
