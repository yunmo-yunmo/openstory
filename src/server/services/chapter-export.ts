import { tiptapToPlainText } from "./tiptap-converter";

interface ExportChapter {
	title: string;
	content: string;
}

export function formatChapterExport(chapters: ExportChapter[]): string {
	if (chapters.length === 0) return "";

	return chapters
		.map((ch) => {
			const text = tiptapToPlainText(ch.content);
			return `${ch.title}\n\n${text}`;
		})
		.join("\n\n\n");
}
