import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { ToolSet } from "ai";
import type { createLLMClient } from "../../llm/client";
import { createCheckConsistencyTool } from "./check-consistency";
import { createGenerateSummaryTool } from "./generate-summary";
// Import all tool creators
import { createReadChaptersTool } from "./read-chapters";
import { createReadCharactersTool } from "./read-characters";
import { createSearchMentionsTool } from "./search-mentions";
import { createUpdateOutlineTool } from "./update-outline";
import { createWebSearchTool } from "./web-search";
import { createWriteSectionTool } from "./write-section";

interface ToolRegistryOptions {
	db: PrismaClient;
	projectId: string;
	llmClient: ReturnType<typeof createLLMClient>;
}

export function createToolRegistry(opts: ToolRegistryOptions): ToolSet {
	const ctx = { db: opts.db, projectId: opts.projectId };
	const llmCtx = { ...ctx, llmClient: opts.llmClient };

	return {
		read_chapters: createReadChaptersTool(ctx),
		read_characters: createReadCharactersTool(ctx),
		write_section: createWriteSectionTool(ctx),
		update_outline: createUpdateOutlineTool(ctx),
		search_mentions: createSearchMentionsTool(ctx),
		check_consistency: createCheckConsistencyTool(llmCtx),
		generate_summary: createGenerateSummaryTool(llmCtx),
		web_search: createWebSearchTool(ctx),
	};
}
