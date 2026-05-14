import "server-only";

import type { PrismaClient } from "@prisma/client";
import { createLLMClient } from "../../llm/client";
import { persistConsistencyFindings } from "../../services/agent-finding";
import type { ConsistencyIssue } from "./consistency-agent";
import { checkChapterConsistency } from "./consistency-agent";
import { generateChapterSummary } from "./summary-agent";

export type { ConsistencyIssue };

export interface AgentRunResult {
	summary: string | null;
	consistencyIssues: ConsistencyIssue[];
	errors: string[];
}

type LLMClient = ReturnType<typeof createLLMClient>;

interface AgentRunnerDependencies {
	createLLMClient?: typeof createLLMClient;
	generateChapterSummary?: (
		db: PrismaClient,
		llmClient: LLMClient,
		chapterId: string,
		projectId: string,
	) => Promise<string>;
	checkChapterConsistency?: (
		db: PrismaClient,
		llmClient: LLMClient,
		chapterId: string,
		projectId: string,
	) => Promise<ConsistencyIssue[]>;
	persistConsistencyFindings?: (
		db: PrismaClient,
		input: {
			projectId: string;
			chapterId: string;
			issues: ConsistencyIssue[];
		},
	) => Promise<unknown>;
}

export async function runBackgroundAgents(opts: {
	db: PrismaClient;
	userId: string;
	projectId: string;
	chapterId: string;
	dependencies?: AgentRunnerDependencies;
}): Promise<AgentRunResult> {
	const createClient = opts.dependencies?.createLLMClient ?? createLLMClient;
	const generateSummary =
		opts.dependencies?.generateChapterSummary ?? generateChapterSummary;
	const checkConsistency =
		opts.dependencies?.checkChapterConsistency ?? checkChapterConsistency;
	const persistFindings =
		opts.dependencies?.persistConsistencyFindings ??
		((db, input) => persistConsistencyFindings(db as never, input));

	const llmClient = createClient({
		db: opts.db,
		userId: opts.userId,
	});

	const result: AgentRunResult = {
		summary: null,
		consistencyIssues: [],
		errors: [],
	};

	try {
		result.summary = await generateSummary(
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
		result.consistencyIssues = await checkConsistency(
			opts.db,
			llmClient,
			opts.chapterId,
			opts.projectId,
		);
		try {
			await persistFindings(opts.db, {
				projectId: opts.projectId,
				chapterId: opts.chapterId,
				issues: result.consistencyIssues,
			});
		} catch (error) {
			result.errors.push(
				`Consistency finding persistence failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	} catch (error) {
		result.errors.push(
			`Consistency check failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	return result;
}
