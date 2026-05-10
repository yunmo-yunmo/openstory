export interface SplitResult {
	title: string;
	content: string;
}

/** Combined pattern matching Chinese or English chapter headings. */
const CHAPTER_PATTERN =
	/^(第[一二三四五六七八九十百千万零\d]+[章节卷回]\s*.+|Chapter\s+\d+[^\n]*|CHAPTER\s+\d+[^\n]*)/m;

/** Separator: 3+ consecutive =, *, or - characters on their own line. */
const SEPARATOR_LINE = /^[-=*]{3,}\s*$/m;

/** Fallback: 3+ consecutive blank lines. */
const BLANK_RUN = /\n\s*\n\s*\n\s*\n/;

export function splitChapters(text: string): SplitResult[] {
	const trimmed = text.trim();
	if (!trimmed) return [];

	// Try chapter heading patterns first (highest priority)
	if (CHAPTER_PATTERN.test(trimmed)) {
		return splitByPattern(trimmed, CHAPTER_PATTERN);
	}

	// Try separator lines
	if (SEPARATOR_LINE.test(trimmed)) {
		return splitBySeparator(trimmed);
	}

	// Try blank-line runs (5+ consecutive blank lines = 4+ empty newlines)
	if (BLANK_RUN.test(trimmed)) {
		return splitByBlankLines(trimmed);
	}

	// No markers found — single chapter
	return [{ title: "未命名章节", content: trimmed }];
}

function splitByPattern(text: string, pattern: RegExp): SplitResult[] {
	const lines = text.split("\n");
	const chapters: SplitResult[] = [];
	let currentTitle = "";
	let currentLines: string[] = [];

	for (const line of lines) {
		if (pattern.test(line.trim())) {
			if (currentTitle || currentLines.length > 0) {
				chapters.push({
					title: currentTitle || "未命名章节",
					content: currentLines.join("\n").trim(),
				});
			}
			currentTitle = line.trim();
			currentLines = [];
		} else {
			currentLines.push(line);
		}
	}

	if (currentTitle || currentLines.length > 0) {
		const content = currentLines.join("\n").trim();
		chapters.push({
			title: currentTitle || "未命名章节",
			content,
		});
	}

	return chapters.filter((ch) => ch.title || ch.content);
}

function splitBySeparator(text: string): SplitResult[] {
	const lines = text.split("\n");
	const sections: string[][] = [[]];

	for (const line of lines) {
		if (SEPARATOR_LINE.test(line.trim())) {
			sections.push([]);
		} else {
			sections.at(-1)?.push(line);
		}
	}

	return sections
		.map((sectionLines) => {
			const content = sectionLines.join("\n").trim();
			if (!content) return null;
			const [firstLineRaw = ""] = content.split("\n");
			const firstLine = firstLineRaw.trim();
			const rest = content.slice(firstLine.length).trim();
			return { title: firstLine, content: rest || firstLine };
		})
		.filter((r): r is SplitResult => r !== null);
}

function splitByBlankLines(text: string): SplitResult[] {
	// Split on 3+ consecutive blank lines
	const parts = text.split(/\n\s*\n\s*\n\s*\n/);
	return parts
		.map((part) => {
			const trimmed = part.trim();
			if (!trimmed) return null;
			const [firstLineRaw = ""] = trimmed.split("\n");
			const firstLine = firstLineRaw.trim();
			const rest = trimmed.slice(firstLine.length).trim();
			return { title: firstLine, content: rest || trimmed };
		})
		.filter((r): r is SplitResult => r !== null);
}
