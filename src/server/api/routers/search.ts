import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { extractSnippet } from "~/server/services/text-utils";
import { tiptapToPlainText } from "~/server/services/tiptap-converter";

export const searchRouter = createTRPCRouter({
	searchAll: protectedProcedure
		.input(z.object({ projectId: z.string(), query: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const lowerQuery = input.query.toLowerCase();

			const [chapters, characters, worldNotes] = await Promise.all([
				ctx.db.chapter.findMany({
					where: {
						projectId: input.projectId,
						project: { userId: ctx.session.user.id },
					},
					select: { id: true, title: true, order: true, content: true },
				}),
				ctx.db.character.findMany({
					where: {
						projectId: input.projectId,
						project: { userId: ctx.session.user.id },
					},
				}),
				ctx.db.worldNote.findMany({
					where: {
						projectId: input.projectId,
						project: { userId: ctx.session.user.id },
					},
				}),
			]);

			const chapterMatches = chapters
				.filter((ch) => {
					const text = tiptapToPlainText(ch.content);
					return (
						text.toLowerCase().includes(lowerQuery) ||
						ch.title.toLowerCase().includes(lowerQuery)
					);
				})
				.map((ch) => ({
					type: "chapter" as const,
					id: ch.id,
					title: ch.title,
					order: ch.order,
					snippet: extractSnippet(
						tiptapToPlainText(ch.content),
						input.query,
						80,
					),
				}));

			const characterMatches = characters
				.filter((c) => {
					const searchText = [c.name, c.description, c.traits, c.notes].join(
						" ",
					);
					return searchText.toLowerCase().includes(lowerQuery);
				})
				.map((c) => ({
					type: "character" as const,
					id: c.id,
					name: c.name,
					description: c.description,
				}));

			const worldNoteMatches = worldNotes
				.filter((n) => {
					const text = tiptapToPlainText(n.content);
					return (
						text.toLowerCase().includes(lowerQuery) ||
						n.title.toLowerCase().includes(lowerQuery)
					);
				})
				.map((n) => ({
					type: "worldNote" as const,
					id: n.id,
					title: n.title,
					category: n.category,
					snippet: extractSnippet(
						tiptapToPlainText(n.content),
						input.query,
						80,
					),
				}));

			return [...chapterMatches, ...characterMatches, ...worldNoteMatches];
		}),
});
