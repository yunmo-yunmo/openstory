import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hasRevisionEditIntent } from "../../app/_components/story-bible-types";
import {
	acceptRevisionProposal,
	appendToTipTapDoc,
	hashChapterContent,
	replaceParagraphsInTipTapDoc,
	validateRevisionProposalDraft,
} from "./revision-proposal";
import { tiptapToPlainText, tiptapToRawText } from "./tiptap-converter";

function tiptapDoc(text: string): string {
	return JSON.stringify({
		type: "doc",
		content: text.split(/\n{2,}/).map((paragraph) => ({
			type: "paragraph",
			content: paragraph ? [{ type: "text", text: paragraph }] : [],
		})),
	});
}

function createDbState(options: {
	chapterText: string;
	proposal: {
		status?: string;
		operation: "append" | "replace";
		originalText?: string | null;
		replacementText: string;
		baseContentHash?: string;
	};
}) {
	const chapter = {
		id: "chapter-1",
		projectId: "project-1",
		title: "Chapter One",
		content: tiptapDoc(options.chapterText),
		wordCount: 0,
		summary: null,
		updatedAt: new Date("2026-05-14T10:00:00.000Z"),
	};
	const proposal = {
		id: "proposal-1",
		projectId: "project-1",
		chapterId: chapter.id,
		sessionId: "session-1",
		status: options.proposal.status ?? "pending",
		operation: options.proposal.operation,
		instruction: "Revise the chapter",
		targetHint: null,
		originalText: options.proposal.originalText ?? null,
		replacementText: options.proposal.replacementText,
		baseContentHash:
			options.proposal.baseContentHash ?? hashChapterContent(chapter.content),
		createdAt: new Date("2026-05-12T00:00:00Z"),
		decidedAt: null,
		chapter,
	};
	const snapshots: unknown[] = [];

	const tx = {
		chapterRevisionProposal: {
			findFirst: async () => proposal,
			update: async ({ data }: { data: Record<string, unknown> }) => {
				Object.assign(proposal, data);
				return proposal;
			},
		},
		chapter: {
			update: async ({ data }: { data: Record<string, unknown> }) => {
				Object.assign(chapter, data);
				chapter.updatedAt = new Date("2026-05-14T10:01:00.000Z");
				return chapter;
			},
		},
		chapterSnapshot: {
			findFirst: async () => null,
			create: async ({ data }: { data: Record<string, unknown> }) => {
				snapshots.push(data);
				return data;
			},
		},
	};

	return {
		state: { chapter, proposal, snapshots },
		db: {
			$transaction: async <T>(fn: (transaction: typeof tx) => Promise<T>) =>
				fn(tx),
		},
	};
}

describe("revision proposal service", () => {
	test("hasRevisionEditIntent detects explicit Chinese and English edit requests", () => {
		assert.equal(hasRevisionEditIntent("请续写这一章"), true);
		assert.equal(hasRevisionEditIntent("polish the last scene"), true);
		assert.equal(hasRevisionEditIntent("聊聊这个角色的动机"), false);
	});

	test("validateRevisionProposalDraft accepts safe append drafts", () => {
		const result = validateRevisionProposalDraft(
			{
				operation: "append",
				instruction: "Continue",
				replacementText: "新的段落。",
			},
			"旧正文。",
		);

		assert.deepEqual(result, { ok: true });
	});

	test("validateRevisionProposalDraft rejects unsafe replace drafts with short CJK matches", () => {
		const result = validateRevisionProposalDraft(
			{
				operation: "replace",
				instruction: "Polish",
				targetHint: "last line",
				originalText: "太短了",
				replacementText: "仍然太短。",
			},
			"太短了",
		);

		assert.equal(result.ok, false);
	});

	test("acceptRevisionProposal appends text and creates a snapshot", async () => {
		const { db, state } = createDbState({
			chapterText: "第一段。",
			proposal: {
				operation: "append",
				replacementText: "第二段。",
			},
		});

		const result = await acceptRevisionProposal(db as never, {
			proposalId: "proposal-1",
			userId: "user-1",
		});

		assert.equal(result.ok, true);
		assert.equal(
			result.chapter.updatedAt.toISOString(),
			"2026-05-14T10:01:00.000Z",
		);
		assert.equal(
			tiptapToPlainText(state.chapter.content),
			"第一段。\n\n第二段。",
		);
		assert.equal(state.proposal.status, "accepted");
		assert.equal(state.snapshots.length, 1);
	});

	test("acceptRevisionProposal replaces a unique safe match", async () => {
		const original =
			"她站在门口，听见雨声从屋檐一滴一滴落下，像旧钟一样提醒她不能回头。";
		const replacement =
			"她停在门口，雨声沿着屋檐缓慢坠落，像一只旧钟提醒她再也不能回头。";
		const { db, state } = createDbState({
			chapterText: `开头。\n\n${original}\n\n结尾。`,
			proposal: {
				operation: "replace",
				originalText: original,
				replacementText: replacement,
			},
		});

		const result = await acceptRevisionProposal(db as never, {
			proposalId: "proposal-1",
			userId: "user-1",
		});

		assert.equal(result.ok, true);
		assert.equal(
			tiptapToPlainText(state.chapter.content),
			`开头。\n\n${replacement}\n\n结尾。`,
		);
	});

	test("acceptRevisionProposal expires missing or duplicated replace matches without writing", async () => {
		const original =
			"她站在门口，听见雨声从屋檐一滴一滴落下，像旧钟一样提醒她不能回头。";
		const { db, state } = createDbState({
			chapterText: `${original}\n\n${original}`,
			proposal: {
				operation: "replace",
				originalText: original,
				replacementText: "替换后的文字。",
			},
		});

		const result = await acceptRevisionProposal(db as never, {
			proposalId: "proposal-1",
			userId: "user-1",
		});

		assert.deepEqual(result, {
			ok: false,
			code: "CONFLICT",
			message: "Replacement target is no longer unique.",
		});
		assert.equal(state.proposal.status, "expired");
		assert.equal(
			tiptapToPlainText(state.chapter.content),
			`${original}\n\n${original}`,
		);
	});

	test("acceptRevisionProposal expires stale proposals without writing", async () => {
		const { db, state } = createDbState({
			chapterText: "第一段。",
			proposal: {
				operation: "append",
				replacementText: "第二段。",
				baseContentHash: hashChapterContent("stale content"),
			},
		});

		const result = await acceptRevisionProposal(db as never, {
			proposalId: "proposal-1",
			userId: "user-1",
		});

		assert.equal(result.ok, false);
		assert.equal(result.code, "CONFLICT");
		assert.equal(state.proposal.status, "expired");
		assert.equal(tiptapToPlainText(state.chapter.content), "第一段。");
	});

	test("acceptRevisionProposal rejects terminal proposals", async () => {
		const { db, state } = createDbState({
			chapterText: "第一段。",
			proposal: {
				status: "rejected",
				operation: "append",
				replacementText: "第二段。",
			},
		});

		const result = await acceptRevisionProposal(db as never, {
			proposalId: "proposal-1",
			userId: "user-1",
		});

		assert.deepEqual(result, {
			ok: false,
			code: "BAD_REQUEST",
			message: "Only pending proposals can be accepted.",
		});
		assert.equal(tiptapToPlainText(state.chapter.content), "第一段。");
	});

	test("acceptRevisionProposal preserves bold marks when replacing via TipTap-level path", async () => {
		const doc = JSON.stringify({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "保持", marks: [{ type: "bold" }] }],
				},
				{
					type: "paragraph",
					content: [
						{
							type: "text",
							text: "替换这段文字因为太长了需要足够的长度才能匹配成功。",
						},
					],
				},
			],
		});
		const { db, state } = createDbState({
			chapterText: "placeholder",
			proposal: {
				operation: "replace",
				originalText: "替换这段文字因为太长了需要足够的长度才能匹配成功。",
				replacementText: "新的内容。",
			},
		});
		state.chapter.content = doc;
		state.proposal.baseContentHash = hashChapterContent(doc);

		const result = await acceptRevisionProposal(db as never, {
			proposalId: "proposal-1",
			userId: "user-1",
		});

		assert.equal(result.ok, true);
		const parsed = JSON.parse(state.chapter.content);
		assert.deepEqual(parsed.content[0].content[0].marks, [{ type: "bold" }]);
	});
});

describe("TipTap-level proposal operations", () => {
	test("appendToTipTapDoc adds paragraphs at the end", () => {
		const doc = tiptapDoc("第一段。");
		const result = appendToTipTapDoc(doc, "第二段。");
		assert.equal(tiptapToRawText(result), "第一段。\n\n第二段。");
	});

	test("appendToTipTapDoc handles empty doc", () => {
		const doc = tiptapDoc("");
		const result = appendToTipTapDoc(doc, "新内容。");
		assert.equal(tiptapToRawText(result), "新内容。");
	});

	test("replaceParagraphsInTipTapDoc replaces paragraphs containing originalText", () => {
		const doc = tiptapDoc("开头。\n\n中间段落。\n\n结尾。");
		const result = replaceParagraphsInTipTapDoc(doc, "中间段落。", "替换后。");
		assert.ok(result);
		assert.equal(tiptapToRawText(result), "开头。\n\n替换后。\n\n结尾。");
	});

	test("replaceParagraphsInTipTapDoc returns null when originalText not found", () => {
		const doc = tiptapDoc("开头。\n\n结尾。");
		const result = replaceParagraphsInTipTapDoc(doc, "不存在。", "替换。");
		assert.equal(result, null);
	});

	test("replaceParagraphsInTipTapDoc preserves bold marks outside replaced region", () => {
		const doc = JSON.stringify({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "保持", marks: [{ type: "bold" }] }],
				},
				{ type: "paragraph", content: [{ type: "text", text: "替换我" }] },
			],
		});
		const result = replaceParagraphsInTipTapDoc(doc, "替换我", "新内容");
		assert.ok(result);
		const parsed = JSON.parse(result);
		assert.deepEqual(parsed.content[0].content[0].marks, [{ type: "bold" }]);
		assert.equal(tiptapToRawText(result), "保持\n\n新内容");
	});
});
