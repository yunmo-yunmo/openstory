import assert from "node:assert/strict";
import test from "node:test";

import { assembleContext } from "./context-manager";
import { searchChapterContent, upsertOutline } from "./tools/data-access";

function tiptapDoc(text: string): string {
	return JSON.stringify({
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text }] }],
	});
}

test("assembleContext scopes the current chapter lookup to the project", async () => {
	const foreignChapter = {
		id: "chapter-foreign",
		projectId: "project-foreign",
		title: "Foreign Chapter",
		status: "draft",
		wordCount: 2,
		content: "foreign secret",
		order: 1,
	};
	const db = {
		chapter: {
			findUnique: async ({ where }: { where: Record<string, string> }) =>
				where.id === foreignChapter.id &&
				(where.projectId === undefined ||
					where.projectId === foreignChapter.projectId)
					? foreignChapter
					: null,
			findMany: async () => [],
		},
		outline: { findMany: async () => [] },
		character: { findMany: async () => [] },
		worldNote: { findMany: async () => [] },
	};

	await assert.rejects(
		assembleContext({
			db: db as never,
			projectId: "project-current",
			currentChapterId: foreignChapter.id,
		}),
		/Chapter not found/,
	);
});

test("assembleContext includes scoped world notes and converts TipTap chapter content to plain text", async () => {
	const db = {
		chapter: {
			findUnique: async () => ({
				id: "chapter-1",
				projectId: "project-current",
				title: "Current Chapter",
				status: "draft",
				wordCount: 4,
				content: tiptapDoc("The clean moon text."),
				order: 3,
			}),
			findMany: async () => [],
		},
		outline: { findMany: async () => [] },
		character: { findMany: async () => [] },
		worldNote: {
			findMany: async ({ where }: { where: { projectId: string } }) => {
				assert.equal(where.projectId, "project-current");
				return [
					{
						category: "magic",
						title: "Moon Law",
						content: tiptapDoc("Moon doors only open at low tide."),
					},
				];
			},
		},
	};

	const messages = await assembleContext({
		db: db as never,
		projectId: "project-current",
		currentChapterId: "chapter-1",
		includeL1: false,
	});

	const content = String(messages[0]?.content);
	assert.match(content, /The clean moon text\./);
	assert.match(
		content,
		/- \[magic\] Moon Law: Moon doors only open at low tide\./,
	);
	assert.doesNotMatch(content, /"type":"doc"/);
});

test("upsertOutline updates only outlines in the current project", async () => {
	let updateArgs: unknown;
	const db = {
		outline: {
			update: async (args: unknown) => {
				updateArgs = args;
				return {};
			},
			create: async () => ({}),
		},
	};

	await upsertOutline(db as never, {
		id: "outline-foreign",
		projectId: "project-current",
		title: "Scoped Update",
		order: 1,
	});

	assert.deepEqual(updateArgs, {
		where: { id: "outline-foreign", projectId: "project-current" },
		data: {
			title: "Scoped Update",
			description: undefined,
			order: 1,
			parentId: undefined,
			status: undefined,
		},
	});
});

test("searchChapterContent searches plain TipTap text and returns readable snippets", async () => {
	const chapter = {
		id: "chapter-1",
		title: "Chapter One",
		order: 1,
		content: tiptapDoc("The hidden moon rises over the city."),
	};
	const db = {
		chapter: {
			findMany: async () => [chapter],
		},
	};

	const results = await searchChapterContent(
		db as never,
		"project-1",
		"hidden moon",
	);

	assert.equal(results.length, 1);
	assert.equal(results[0]?.snippet, "The hidden moon rises over the city.");
});
