import "server-only";

import type { PrismaClient } from "@prisma/client";
import { extractSnippet } from "../../services/text-utils";
import { tiptapToPlainText } from "../../services/tiptap-converter";

// ─── Shared types ──────────────────────────────────────────────────────

export interface ToolContext {
	db: PrismaClient;
	projectId: string;
}

export interface ToolContextWithLLM extends ToolContext {
	llmClient: ReturnType<typeof import("../../llm/client").createLLMClient>;
}

export async function getChapterContent(
	db: PrismaClient,
	chapterId: string,
	projectId: string,
) {
	return db.chapter.findUnique({
		where: { id: chapterId, projectId },
		select: {
			id: true,
			title: true,
			content: true,
			order: true,
			wordCount: true,
			summary: true,
		},
	});
}

export async function getChaptersByProject(
	db: PrismaClient,
	projectId: string,
) {
	return db.chapter.findMany({
		where: { projectId },
		orderBy: { order: "asc" },
		select: {
			id: true,
			title: true,
			order: true,
			summary: true,
			wordCount: true,
			status: true,
		},
	});
}

export async function updateChapterContent(
	db: PrismaClient,
	chapterId: string,
	projectId: string,
	content: string,
	options?: { title?: string; wordCount?: number },
) {
	return db.chapter.update({
		where: { id: chapterId, projectId },
		data: {
			content,
			...(options?.title !== undefined ? { title: options.title } : {}),
			...(options?.wordCount !== undefined
				? { wordCount: options.wordCount }
				: {}),
		},
	});
}

// ─── Character access ──────────────────────────────────────────────────

export async function getCharacterDetail(
	db: PrismaClient,
	characterId: string,
	projectId: string,
) {
	return db.character.findUnique({
		where: { id: characterId, projectId },
	});
}

export async function getCharactersByProject(
	db: PrismaClient,
	projectId: string,
) {
	return db.character.findMany({
		where: { projectId },
	});
}

// ─── Outline access ────────────────────────────────────────────────────

export async function getOutlinesByProject(
	db: PrismaClient,
	projectId: string,
) {
	return db.outline.findMany({
		where: { projectId },
		orderBy: { order: "asc" },
	});
}

export async function upsertOutline(
	db: PrismaClient,
	data: {
		id?: string;
		projectId: string;
		title: string;
		description?: string;
		order: number;
		parentId?: string;
		status?: string;
	},
) {
	if (data.id) {
		return db.outline.update({
			where: { id: data.id, projectId: data.projectId },
			data: {
				title: data.title,
				description: data.description,
				order: data.order,
				parentId: data.parentId,
				status: data.status,
			},
		});
	}

	return db.outline.create({
		data: {
			projectId: data.projectId,
			title: data.title,
			description: data.description,
			order: data.order,
			parentId: data.parentId,
			status: data.status ?? "planned",
		},
	});
}

// ─── Search ────────────────────────────────────────────────────────────

export async function searchChapterContent(
	db: PrismaClient,
	projectId: string,
	query: string,
) {
	const chapters = await db.chapter.findMany({
		where: { projectId },
		select: {
			id: true,
			title: true,
			order: true,
			content: true,
		},
	});

	const lowerQuery = query.toLowerCase();

	return chapters
		.map((ch) => ({
			...ch,
			plainText: tiptapToPlainText(ch.content),
		}))
		.filter((ch) => ch.plainText.toLowerCase().includes(lowerQuery))
		.map((ch) => ({
			chapterId: ch.id,
			title: ch.title,
			order: ch.order,
			snippet: extractSnippet(ch.plainText, query, 100),
		}));
}

// ─── Snapshot ──────────────────────────────────────────────────────────

export async function createSnapshot(
	db: PrismaClient,
	chapterId: string,
	projectId: string,
) {
	return db.$transaction(async (tx) => {
		const chapter = await tx.chapter.findUnique({
			where: { id: chapterId, projectId },
		});

		if (!chapter) return null;

		const latestSnapshot = await tx.chapterSnapshot.findFirst({
			where: { chapterId },
			orderBy: { version: "desc" },
			select: { version: true },
		});

		const nextVersion = (latestSnapshot?.version ?? 0) + 1;

		return tx.chapterSnapshot.create({
			data: {
				chapterId: chapter.id,
				content: chapter.content,
				wordCount: chapter.wordCount,
				summary: chapter.summary,
				version: nextVersion,
			},
		});
	});
}
