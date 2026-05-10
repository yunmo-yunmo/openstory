import { tiptapToPlainText } from "../../services/tiptap-converter";

const SUMMARY_LIMIT = 300;

export function parseWorldNoteTags(tags: string | null | undefined) {
	if (!tags) return [];
	try {
		const parsed: unknown = JSON.parse(tags);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((tag): tag is string => typeof tag === "string");
	} catch {
		return [];
	}
}

export function serializeWorldNoteTags(tags: string[]) {
	const normalized = tags
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);
	return JSON.stringify([...new Set(normalized)]);
}

export function worldNoteToPlainTextSummary(note: {
	category: string;
	title: string;
	content: string;
}) {
	const text = tiptapToPlainText(note.content).trim();
	const truncated =
		text.length > SUMMARY_LIMIT ? `${text.slice(0, SUMMARY_LIMIT)}...` : text;
	return `- [${note.category}] ${note.title}${truncated ? `: ${truncated}` : ""}`;
}

export function buildWorldNoteUpdateData(input: {
	title?: string;
	content?: string;
	category?: string;
	tags?: string[] | null;
	order?: number;
}) {
	const data: {
		title?: string;
		content?: string;
		category?: string;
		tags?: string | null;
		order?: number;
	} = {};
	if (input.title !== undefined) data.title = input.title;
	if (input.content !== undefined) data.content = input.content;
	if (input.category !== undefined) data.category = input.category;
	if (input.tags !== undefined) {
		data.tags = input.tags === null ? null : serializeWorldNoteTags(input.tags);
	}
	if (input.order !== undefined) data.order = input.order;
	return data;
}
