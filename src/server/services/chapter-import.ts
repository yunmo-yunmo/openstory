import type { SplitResult } from "./chapter-splitter";
import {
	countWords,
	plainTextToTipTap,
	tiptapToPlainText,
} from "./tiptap-converter";

export interface ChapterImportData {
	title: string;
	content: string;
	order: number;
	wordCount: number;
}

export function prepareImportData(
	splits: SplitResult[],
	orderOffset = 0,
): ChapterImportData[] {
	return splits.map((split, index) => {
		const content = plainTextToTipTap(split.content);
		return {
			title: split.title,
			content,
			order: orderOffset + index,
			wordCount: countWords(tiptapToPlainText(content)),
		};
	});
}
