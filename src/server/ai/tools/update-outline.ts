import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./data-access";
import { upsertOutline } from "./data-access";

export function createUpdateOutlineTool(ctx: ToolContext) {
	return tool({
		description:
			"Create or update an outline node. If an 'id' is provided the existing outline is updated; otherwise a new outline node is created. Outlines represent the planned structure of chapters.",
		inputSchema: z.object({
			id: z
				.string()
				.optional()
				.describe("Existing outline ID to update (omit to create a new one)"),
			title: z.string().describe("Title of the outline node"),
			description: z
				.string()
				.optional()
				.describe("Optional longer description"),
			order: z.number().describe("Sort order within the project"),
			parentId: z
				.string()
				.optional()
				.describe("ID of a parent outline node, if this is a child"),
			status: z
				.string()
				.optional()
				.describe("Status: planned | writing | done"),
		}),
		execute: async (input) => {
			const result = await upsertOutline(ctx.db, {
				...input,
				projectId: ctx.projectId,
			});

			return result;
		},
	});
}
