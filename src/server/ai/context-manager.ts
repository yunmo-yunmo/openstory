import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { ModelMessage } from "ai";
import { buildOutlineTreeLabel } from "../api/routers/outline-helpers";
import { worldNoteToPlainTextSummary } from "../api/routers/world-note-helpers";
import { tiptapToPlainText } from "../services/tiptap-converter";

async function buildL0Context(
	db: PrismaClient,
	projectId: string,
	currentChapter: {
		title: string;
		status: string;
		wordCount: number;
		content: string;
	},
): Promise<string> {
	const [outlines, characters, worldNotes] = await Promise.all([
		db.outline.findMany({
			where: { projectId },
			orderBy: { order: "asc" },
		}),
		db.character.findMany({ where: { projectId } }),
		db.worldNote.findMany({
			where: { projectId },
			orderBy: [{ order: "asc" }, { title: "asc" }],
		}),
	]);
	const currentChapterPlainText = tiptapToPlainText(currentChapter.content);

	return [
		"## Current Chapter",
		`Title: ${currentChapter.title}`,
		`Status: ${currentChapter.status}`,
		`Word Count: ${currentChapter.wordCount}`,
		"",
		"### Content",
		currentChapterPlainText,
		"",
		"### Full Outline",
		outlines.length > 0
			? outlines
					.map((outline) => `- ${buildOutlineTreeLabel(outline)}`)
					.join("\n")
			: "(No outline yet)",
		"",
		"### Characters",
		characters.length > 0
			? characters
					.map(
						(c) =>
							`- ${c.name}${c.description ? `: ${c.description}` : ""}${c.traits ? ` (traits: ${c.traits})` : ""}`,
					)
					.join("\n")
			: "(No characters defined)",
		"",
		"### World Notes",
		worldNotes.length > 0
			? worldNotes.map((note) => worldNoteToPlainTextSummary(note)).join("\n")
			: "(No world notes defined)",
	].join("\n");
}

async function buildL1Context(
	db: PrismaClient,
	projectId: string,
	currentOrder: number,
): Promise<string> {
	const neighbors = await db.chapter.findMany({
		where: {
			projectId,
			order: { gte: currentOrder - 3, lte: currentOrder + 1 },
			summary: { not: null },
		},
		orderBy: { order: "asc" },
		select: { title: true, summary: true, order: true },
	});

	const relevant = neighbors.filter((c) => c.order !== currentOrder);
	if (relevant.length === 0) return "";

	return [
		"## Neighboring Chapter Summaries",
		...relevant.map((c) => `- [Ch${c.order}] ${c.title}: ${c.summary}`),
	].join("\n");
}

export async function assembleContext(options: {
	db: PrismaClient;
	projectId: string;
	currentChapterId: string;
	includeL1?: boolean;
}): Promise<ModelMessage[]> {
	const { db, projectId, currentChapterId, includeL1 = true } = options;

	const currentChapter = await db.chapter.findUnique({
		where: { id: currentChapterId, projectId },
	});
	if (!currentChapter)
		throw new Error(`Chapter not found: ${currentChapterId}`);

	const l0 = await buildL0Context(db, projectId, currentChapter);

	const systemPrompt = [
		"You are an AI writing assistant for a novel project.",
		"Your role is to help the author write, edit, and plan their novel.",
		"You can read chapters, search the text, check consistency, update outlines, generate summaries, and write text.",
		"Always be constructive and specific in your feedback.",
		"When suggesting text, match the author's style and tone.",
		"",
		"Below is the current context of the project:",
		l0,
	].join("\n");

	const messages: ModelMessage[] = [{ role: "system", content: systemPrompt }];

	if (includeL1) {
		const l1 = await buildL1Context(db, projectId, currentChapter.order);
		if (l1) {
			messages.push({ role: "system", content: l1 });
		}
	}

	return messages;
}
