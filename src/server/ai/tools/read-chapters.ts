import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./data-access";
import { getChapterContent } from "./data-access";

export function createReadChaptersTool(ctx: ToolContext) {
	return tool({
		description:
			"Read one or more chapters by their IDs. Returns chapter id, title, order, content (TipTap JSON), and word count for each.",
		inputSchema: z.object({
			chapterIds: z.array(z.string()).describe("Array of chapter IDs to fetch"),
		}),
		execute: async (input) => {
			const chapters = await Promise.all(
				input.chapterIds.map((id) =>
					getChapterContent(ctx.db, id, ctx.projectId),
				),
			);

			return chapters
				.filter((ch): ch is NonNullable<typeof ch> => ch !== null)
				.map((ch) => ({
					id: ch.id,
					title: ch.title,
					order: ch.order,
					content: ch.content,
					wordCount: ch.wordCount,
				}));
		},
	});
}
