import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { plainTextToTipTap } from "../../services/tiptap-converter";
import type { ToolContext } from "./data-access";
import {
	createSnapshot,
	getChapterContent,
	updateChapterContent,
} from "./data-access";

/** TipTap JSON node structure (minimal types for local use). */
interface TipTapNode {
	type: string;
	content?: TipTapNode[];
	text?: string;
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

interface TipTapDoc {
	type: "doc";
	content: TipTapNode[];
}

/**
 * Convert plain text into an array of TipTap paragraph nodes.
 * Double newlines (`\n\n`) separate paragraphs; single newlines
 * within a paragraph become `hardBreak` nodes.
 */
function plainTextToTipTapNodes(text: string): TipTapNode[] {
	if (!text.trim()) return [];

	const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
	return paragraphs.map((p) => {
		const lines = p.split("\n");
		const nodes: TipTapNode[] = [];
		for (let i = 0; i < lines.length; i++) {
			nodes.push({ type: "text", text: lines[i] });
			if (i < lines.length - 1) {
				nodes.push({ type: "hardBreak" });
			}
		}
		return { type: "paragraph", content: nodes };
	});
}

/** Safely parse TipTap JSON, returning null on failure. */
function parseTipTapDoc(json: string): TipTapDoc | null {
	try {
		const doc = JSON.parse(json);
		if (doc && doc.type === "doc" && Array.isArray(doc.content)) {
			return doc as TipTapDoc;
		}
		return null;
	} catch {
		return null;
	}
}

export function createWriteSectionTool(ctx: ToolContext) {
	return tool({
		description:
			"Write content into a chapter. Use mode 'replace' to overwrite the entire chapter, 'append' to add content at the end, or 'insert' to add content at the beginning. The content parameter accepts plain text and will be converted to TipTap JSON automatically.",
		inputSchema: z.object({
			chapterId: z.string().describe("The ID of the target chapter"),
			content: z.string().describe("Plain text content to write"),
			mode: z
				.enum(["insert", "append", "replace"])
				.describe(
					"How to apply the content: 'replace' overwrites the chapter, 'append' adds to the end, 'insert' adds to the beginning",
				),
		}),
		execute: async (input) => {
			const existing = await getChapterContent(
				ctx.db,
				input.chapterId,
				ctx.projectId,
			);
			if (!existing) {
				throw new Error(`Chapter not found: ${input.chapterId}`);
			}

			const { content, mode } = input;
			let newContent: string;

			switch (mode) {
				case "replace":
					newContent = plainTextToTipTap(content);
					break;
				case "append": {
					const newNodes = plainTextToTipTapNodes(content);
					const doc = parseTipTapDoc(existing.content);
					if (doc) {
						doc.content.push(...newNodes);
						newContent = JSON.stringify(doc);
					} else {
						// Fallback: existing content is not valid TipTap JSON
						newContent = plainTextToTipTap(content);
					}
					break;
				}
				case "insert": {
					const newNodes = plainTextToTipTapNodes(content);
					const doc = parseTipTapDoc(existing.content);
					if (doc) {
						doc.content.unshift(...newNodes);
						newContent = JSON.stringify(doc);
					} else {
						// Fallback: existing content is not valid TipTap JSON
						newContent = plainTextToTipTap(content);
					}
					break;
				}
				default:
					throw new Error(`Unknown write mode: ${mode}`);
			}

			const updated = await updateChapterContent(
				ctx.db,
				input.chapterId,
				ctx.projectId,
				newContent,
			);

			await createSnapshot(ctx.db, input.chapterId, ctx.projectId);

			return updated;
		},
	});
}
