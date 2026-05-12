import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import {
	countWords,
	plainTextToTipTap,
	tiptapToPlainText,
	tiptapToRawText,
} from "./tiptap-converter";

export const proposalStatusSchema = z.enum([
	"pending",
	"accepted",
	"rejected",
	"expired",
]);

export const proposalOperationSchema = z.enum(["append", "replace"]);

export const revisionProposalDraftSchema = z.discriminatedUnion("operation", [
	z.object({
		operation: z.literal("append"),
		instruction: z.string().min(1),
		replacementText: z.string().min(1),
	}),
	z.object({
		operation: z.literal("replace"),
		instruction: z.string().min(1),
		targetHint: z.string().min(1),
		originalText: z.string().min(1),
		replacementText: z.string().min(1),
	}),
]);

export type RevisionProposalDraft = z.infer<typeof revisionProposalDraftSchema>;

type ProposalRecord = {
	id: string;
	projectId: string;
	chapterId: string;
	sessionId: string | null;
	status: string;
	operation: string;
	instruction: string;
	targetHint: string | null;
	originalText: string | null;
	replacementText: string;
	baseContentHash: string;
	createdAt: Date;
	decidedAt: Date | null;
	chapter: ChapterRecord;
};

type ChapterRecord = {
	id: string;
	projectId: string;
	title: string;
	content: string;
	wordCount: number;
	summary: string | null;
};

type RevisionTransaction = {
	chapterRevisionProposal: {
		findFirst(args: unknown): Promise<ProposalRecord | null>;
		update(args: unknown): Promise<ProposalRecord>;
	};
	chapter: {
		update(args: unknown): Promise<ChapterRecord>;
	};
	chapterSnapshot: {
		findFirst(args: unknown): Promise<{ version: number } | null>;
		create(args: unknown): Promise<unknown>;
	};
};

type RevisionDb = {
	$transaction<T>(fn: (tx: RevisionTransaction) => Promise<T>): Promise<T>;
};

export type RevisionResult<T> =
	| ({ ok: true } & T)
	| {
			ok: false;
			code: "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT";
			message: string;
	  };

const EDIT_INTENT_PATTERNS = [
	"续写",
	"改写",
	"重写",
	"润色",
	"扩写",
	"缩写",
	"continue",
	"rewrite",
	"polish",
	"expand",
	"shorten",
];

export function hasRevisionEditIntent(message: string) {
	const normalized = message.toLowerCase();
	return EDIT_INTENT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function hashChapterContent(content: string) {
	return createHash("sha256").update(content).digest("hex");
}

function cjkCount(text: string) {
	return Array.from(text).filter((char) => /\p{Script=Han}/u.test(char)).length;
}

function hasCjk(text: string) {
	return /\p{Script=Han}/u.test(text);
}

function isSafeOriginalText(text: string) {
	if (hasCjk(text)) return cjkCount(text) >= 20;
	return text.replace(/\s/g, "").length >= 80;
}

function countExactOccurrences(text: string, needle: string) {
	if (!needle) return 0;
	let count = 0;
	let index = text.indexOf(needle);
	while (index !== -1) {
		count += 1;
		index = text.indexOf(needle, index + needle.length);
	}
	return count;
}

export function validateRevisionProposalDraft(
	draft: RevisionProposalDraft,
	chapterPlainText: string,
): { ok: true } | { ok: false; message: string } {
	if (!draft.replacementText.trim()) {
		return { ok: false, message: "Replacement text is empty." };
	}

	if (draft.operation === "append") {
		return { ok: true };
	}

	if (!draft.originalText.trim()) {
		return { ok: false, message: "Original text is empty." };
	}
	if (!isSafeOriginalText(draft.originalText)) {
		return { ok: false, message: "Replacement target is too short." };
	}
	const occurrences = countExactOccurrences(
		chapterPlainText,
		draft.originalText,
	);
	if (occurrences !== 1) {
		return { ok: false, message: "Replacement target is not unique." };
	}

	return { ok: true };
}

function appendText(currentPlainText: string, replacementText: string) {
	const current = currentPlainText.trimEnd();
	const replacement = replacementText.trimStart();
	if (!current) return replacement;
	return `${current}\n\n${replacement}`;
}

interface TipTapDoc {
	type: "doc";
	content: TipTapParagraph[];
}

interface TipTapParagraph {
	type: "paragraph";
	content: TipTapNode[];
}

interface TipTapNode {
	type: string;
	text?: string;
	marks?: Array<{ type: string }>;
	content?: TipTapNode[];
}

export function appendToTipTapDoc(
	docJson: string,
	replacementText: string,
): string {
	const doc: TipTapDoc = JSON.parse(docJson);
	const newParagraphs = replacementText
		.split(/\n{2,}/)
		.filter(Boolean)
		.map((text) => ({
			type: "paragraph" as const,
			content: [{ type: "text" as const, text }],
		}));

	if (doc.content.length === 0) {
		return JSON.stringify({ type: "doc", content: newParagraphs });
	}

	const lastParagraph = doc.content[doc.content.length - 1];
	const lastText =
		lastParagraph?.content.map((n) => n.text ?? "").join("") ?? "";
	if (!lastText.trim()) {
		doc.content.pop();
	}

	return JSON.stringify({
		type: "doc",
		content: [...doc.content, ...newParagraphs],
	});
}

export function replaceParagraphsInTipTapDoc(
	docJson: string,
	originalText: string,
	replacementText: string,
): string | null {
	const doc: TipTapDoc = JSON.parse(docJson);
	const rawText = tiptapToRawText(docJson);

	const matchIndex = rawText.indexOf(originalText);
	if (matchIndex === -1) return null;

	// Build a map of paragraph index -> char range in raw text
	let charOffset = 0;
	const paragraphRanges: Array<{ start: number; end: number }> = [];
	for (let i = 0; i < doc.content.length; i++) {
		const paraText =
			doc.content[i]?.content.map((n) => n.text ?? "").join("") ?? "";
		const start = charOffset;
		const end = charOffset + paraText.length;
		paragraphRanges.push({ start, end });
		charOffset = end + (i < doc.content.length - 1 ? 2 : 0);
	}

	const matchEnd = matchIndex + originalText.length;
	const startParaIdx = paragraphRanges.findIndex((r) => r.end > matchIndex);
	const endParaIdx = paragraphRanges.findIndex((r) => r.end >= matchEnd);

	if (startParaIdx === -1 || endParaIdx === -1) return null;

	const newParagraphs = replacementText
		.split(/\n{2,}/)
		.filter(Boolean)
		.map((text) => ({
			type: "paragraph" as const,
			content: [{ type: "text" as const, text }],
		}));

	const newContent = [
		...doc.content.slice(0, startParaIdx),
		...newParagraphs,
		...doc.content.slice(endParaIdx + 1),
	];

	return JSON.stringify({ type: "doc", content: newContent });
}

function replaceText(
	currentPlainText: string,
	originalText: string | null,
	replacementText: string,
): RevisionResult<{ plainText: string }> {
	if (!originalText) {
		return {
			ok: false,
			code: "CONFLICT",
			message: "Replacement target is missing.",
		};
	}
	const occurrences = countExactOccurrences(currentPlainText, originalText);
	if (occurrences !== 1) {
		return {
			ok: false,
			code: "CONFLICT",
			message: "Replacement target is no longer unique.",
		};
	}
	return {
		ok: true,
		plainText: currentPlainText.replace(originalText, replacementText),
	};
}

async function createSnapshotWithTransaction(
	tx: RevisionTransaction,
	chapter: ChapterRecord,
) {
	const latestSnapshot = await tx.chapterSnapshot.findFirst({
		where: { chapterId: chapter.id },
		orderBy: { version: "desc" },
		select: { version: true },
	});
	const nextVersion = (latestSnapshot?.version ?? 0) + 1;

	await tx.chapterSnapshot.create({
		data: {
			chapterId: chapter.id,
			content: chapter.content,
			wordCount: chapter.wordCount,
			summary: chapter.summary,
			version: nextVersion,
		},
	});
}

async function expireProposal(
	tx: RevisionTransaction,
	proposalId: string,
	message: string,
): Promise<RevisionResult<never>> {
	await tx.chapterRevisionProposal.update({
		where: { id: proposalId },
		data: { status: "expired", decidedAt: new Date() },
	});
	return { ok: false, code: "CONFLICT", message };
}

export async function acceptRevisionProposal(
	db: RevisionDb,
	options: { proposalId: string; userId: string },
): Promise<
	RevisionResult<{
		proposal: ProposalRecord;
		chapter: ChapterRecord;
		projectId: string;
		chapterId: string;
	}>
> {
	return db.$transaction(async (tx) => {
		const proposal = await tx.chapterRevisionProposal.findFirst({
			where: {
				id: options.proposalId,
				project: { userId: options.userId },
			},
			include: { chapter: true },
		});

		if (!proposal) {
			return {
				ok: false,
				code: "NOT_FOUND",
				message: "Revision proposal not found.",
			};
		}
		if (proposal.status !== "pending") {
			return {
				ok: false,
				code: "BAD_REQUEST",
				message: "Only pending proposals can be accepted.",
			};
		}

		const currentHash = hashChapterContent(proposal.chapter.content);
		if (currentHash !== proposal.baseContentHash) {
			return expireProposal(
				tx,
				proposal.id,
				"Chapter changed after this proposal was generated.",
			);
		}

		// Try TipTap-level operation first (preserves rich-text formatting)
		let newContent: string;
		let newWordCount: number;

		if (proposal.operation === "append") {
			const tiptapResult = appendToTipTapDoc(
				proposal.chapter.content,
				proposal.replacementText,
			);
			if (tiptapResult) {
				newContent = tiptapResult;
				newWordCount = countWords(tiptapToRawText(newContent));
			} else {
				const currentPlainText = tiptapToPlainText(proposal.chapter.content);
				const plainResult = appendText(currentPlainText, proposal.replacementText);
				newContent = plainTextToTipTap(plainResult);
				newWordCount = countWords(plainResult);
			}
		} else if (proposal.operation === "replace") {
			const rawText = tiptapToRawText(proposal.chapter.content);
			const occurrences = countExactOccurrences(
				rawText,
				proposal.originalText ?? "",
			);
			if (occurrences !== 1) {
				return expireProposal(tx, proposal.id, "Replacement target is no longer unique.");
			}

			const tiptapResult = replaceParagraphsInTipTapDoc(
				proposal.chapter.content,
				proposal.originalText ?? "",
				proposal.replacementText,
			);
			if (tiptapResult) {
				newContent = tiptapResult;
				newWordCount = countWords(tiptapToRawText(newContent));
			} else {
				const currentPlainText = tiptapToPlainText(proposal.chapter.content);
				const replaced = replaceText(
					currentPlainText,
					proposal.originalText,
					proposal.replacementText,
				);
				if (!replaced.ok) {
					return expireProposal(tx, proposal.id, replaced.message);
				}
				newContent = plainTextToTipTap(replaced.plainText);
				newWordCount = countWords(replaced.plainText);
			}
		} else {
			return {
				ok: false,
				code: "BAD_REQUEST",
				message: "Unsupported revision proposal operation.",
			};
		}

		const updatedChapter = await tx.chapter.update({
			where: { id: proposal.chapterId, projectId: proposal.projectId },
			data: {
				content: newContent,
				wordCount: newWordCount,
			},
		});

		await createSnapshotWithTransaction(tx, updatedChapter);

		const acceptedProposal = await tx.chapterRevisionProposal.update({
			where: { id: proposal.id },
			data: { status: "accepted", decidedAt: new Date() },
		});

		return {
			ok: true,
			proposal: acceptedProposal,
			chapter: updatedChapter,
			projectId: proposal.projectId,
			chapterId: proposal.chapterId,
		};
	});
}

export async function rejectRevisionProposal(
	db: RevisionDb,
	options: { proposalId: string; userId: string },
): Promise<RevisionResult<{ proposal: ProposalRecord }>> {
	return db.$transaction(async (tx) => {
		const proposal = await tx.chapterRevisionProposal.findFirst({
			where: {
				id: options.proposalId,
				project: { userId: options.userId },
			},
		});

		if (!proposal) {
			return {
				ok: false,
				code: "NOT_FOUND",
				message: "Revision proposal not found.",
			};
		}
		if (proposal.status !== "pending") {
			return {
				ok: false,
				code: "BAD_REQUEST",
				message: "Only pending proposals can be rejected.",
			};
		}

		const rejectedProposal = await tx.chapterRevisionProposal.update({
			where: { id: proposal.id },
			data: { status: "rejected", decidedAt: new Date() },
		});

		return { ok: true, proposal: rejectedProposal };
	});
}
