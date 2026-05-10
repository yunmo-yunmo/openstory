import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./data-access";
import { searchChapterContent } from "./data-access";

export function createSearchMentionsTool(ctx: ToolContext) {
	return tool({
		description:
			"Search for a keyword or character name across all chapter content in the project. Returns matching chapters with the surrounding context snippets.",
		inputSchema: z.object({
			query: z.string().describe("Keyword or character name to search for"),
		}),
		execute: async (input) => {
			const results = await searchChapterContent(
				ctx.db,
				ctx.projectId,
				input.query,
			);

			return results;
		},
	});
}
