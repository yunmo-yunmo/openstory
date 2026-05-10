import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./data-access";

export function createWebSearchTool(_ctx: ToolContext) {
	return tool({
		description:
			"Search the web for reference material. NOT YET AVAILABLE — do not call this tool.",
		inputSchema: z.object({
			query: z.string().describe("The search query"),
		}),
		execute: async () => {
			return "Error: Web search is not yet implemented. Use your training knowledge instead.";
		},
	});
}
