import "server-only";
import type { PrismaClient } from "@prisma/client";
import { tool } from "ai";
import { z } from "zod";
import type { createLLMClient } from "../../llm/client";
import { tiptapToPlainText } from "../../services/tiptap-converter";
import type { ToolContextWithLLM } from "./data-access";
import { getChapterContent } from "./data-access";

export async function generateSummary(
	db: PrismaClient,
	llmClient: ReturnType<typeof createLLMClient>,
	chapterId: string,
	projectId: string,
): Promise<string> {
	const chapter = await getChapterContent(db, chapterId, projectId);
	if (!chapter) {
		throw new Error(`Chapter not found: ${chapterId}`);
	}

	const plainContent = tiptapToPlainText(chapter.content);

	const prompt = [
		"Summarize the following chapter in 2-3 concise sentences. Focus on the key plot events, character developments, and important revelations.",
		"",
		`Title: ${chapter.title}`,
		"",
		plainContent,
	].join("\n");

	const result = await llmClient.generate({
		task: "summary",
		messages: [{ role: "user", content: prompt }],
		maxTokens: 200,
		temperature: 0.3,
	});

	const summary = result.text.trim();

	await db.chapter.update({
		where: { id: chapterId, projectId },
		data: {
			summary,
			summaryUpdatedAt: new Date(),
		},
	});

	return summary;
}

export function createGenerateSummaryTool(ctx: ToolContextWithLLM) {
	return tool({
		description:
			"Generate a 2-3 sentence summary for a chapter and save it to the database. The summary is stored on the chapter record and can be used later for context assembly.",
		inputSchema: z.object({
			chapterId: z.string().describe("The ID of the chapter to summarize"),
		}),
		execute: async (input) => {
			return generateSummary(
				ctx.db,
				ctx.llmClient,
				input.chapterId,
				ctx.projectId,
			);
		},
	});
}
