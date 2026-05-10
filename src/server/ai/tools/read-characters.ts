import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./data-access";
import { getCharacterDetail, getCharactersByProject } from "./data-access";

export function createReadCharactersTool(ctx: ToolContext) {
	return tool({
		description:
			"Read characters from the project. Pass 'all: true' to return every character, or provide specific character IDs.",
		inputSchema: z.object({
			characterIds: z
				.array(z.string())
				.optional()
				.describe("Specific character IDs to fetch"),
			all: z
				.boolean()
				.optional()
				.describe("Set to true to return all characters in the project"),
		}),
		execute: async (input) => {
			if (input.all) {
				const characters = await getCharactersByProject(ctx.db, ctx.projectId);
				return characters;
			}

			if (input.characterIds && input.characterIds.length > 0) {
				const characters = await Promise.all(
					input.characterIds.map((id) =>
						getCharacterDetail(ctx.db, id, ctx.projectId),
					),
				);
				return characters.filter(
					(ch): ch is NonNullable<typeof ch> => ch !== null,
				);
			}

			return [];
		},
	});
}
