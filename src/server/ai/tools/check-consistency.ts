import "server-only";
import type { PrismaClient } from "@prisma/client";
import { tool } from "ai";
import { z } from "zod";
import type { createLLMClient } from "../../llm/client";
import { tiptapToPlainText } from "../../services/tiptap-converter";
import type { ToolContextWithLLM } from "./data-access";
import { getChapterContent, getChaptersByProject } from "./data-access";

export interface ConsistencyIssue {
	type: "continuity" | "character" | "plot" | "timeline" | "other";
	description: string;
	severity: "high" | "medium" | "low";
	locations: string[];
}

const consistencyIssueSchema = z.object({
	type: z.enum(["continuity", "character", "plot", "timeline", "other"]),
	description: z.string(),
	severity: z.enum(["high", "medium", "low"]),
	locations: z.array(z.string()),
});

export async function checkConsistency(
	db: PrismaClient,
	llmClient: ReturnType<typeof createLLMClient>,
	chapterId: string,
	projectId: string,
): Promise<ConsistencyIssue[]> {
	const [currentChapter, allChapters] = await Promise.all([
		getChapterContent(db, chapterId, projectId),
		getChaptersByProject(db, projectId),
	]);

	if (!currentChapter) {
		throw new Error(`Chapter not found: ${chapterId}`);
	}

	const otherChapters = allChapters.filter((ch) => ch.id !== chapterId);

	const currentPlain = tiptapToPlainText(currentChapter.content);

	const previousSummaries = otherChapters
		.filter((ch) => ch.summary)
		.sort((a, b) => a.order - b.order)
		.map((ch) => `[Chapter ${ch.order}: "${ch.title}"] ${ch.summary}`)
		.join("\n");

	const prompt = [
		"You are a consistency checker for a novel. Compare the current chapter against previous chapter summaries.",
		"Identify continuity errors, character inconsistencies, plot holes, or timeline issues.",
		"",
		"## Current Chapter (Full Text)",
		`Title: ${currentChapter.title}`,
		`Order: ${currentChapter.order}`,
		currentPlain,
		"",
		"## Previous Chapter Summaries",
		previousSummaries || "(No previous summaries available)",
		"",
		'Return your findings as a JSON array of issues. Each issue must have: type ("continuity" | "character" | "plot" | "timeline" | "other"), description (string), severity ("high" | "medium" | "low"), and locations (array of strings describing where the issue appears). If no issues are found, return an empty array [].',
	].join("\n");

	const result = await llmClient.generate({
		task: "consistency",
		messages: [{ role: "user", content: prompt }],
		maxTokens: 500,
		temperature: 0.3,
	});

	let issues: ConsistencyIssue[] = [];

	try {
		const parsed = JSON.parse(result.text);
		if (Array.isArray(parsed)) {
			issues = parsed.filter((item: unknown) => {
				const r = consistencyIssueSchema.safeParse(item);
				return r.success;
			}) as ConsistencyIssue[];
		}
	} catch {
		// If parsing fails, return raw text as a single issue
		issues = [
			{
				type: "other",
				description: result.text,
				severity: "low",
				locations: [],
			},
		];
	}

	return issues;
}

export function createCheckConsistencyTool(ctx: ToolContextWithLLM) {
	return tool({
		description:
			"Check a chapter for consistency issues against the rest of the project. Compares the current chapter's content with previous chapter summaries and returns a list of potential issues (continuity errors, character inconsistencies, plot holes).",
		inputSchema: z.object({
			chapterId: z.string().describe("The ID of the chapter to check"),
		}),
		execute: async (input) => {
			const issues = await checkConsistency(
				ctx.db,
				ctx.llmClient,
				input.chapterId,
				ctx.projectId,
			);
			return { chapterId: input.chapterId, issues };
		},
	});
}
