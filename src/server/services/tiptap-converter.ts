interface TipTapNode {
	type: string;
	content?: TipTapNode[];
	text?: string;
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

interface TipTapDoc {
	type: "doc";
	content: TipTapNode[];
}

function nodeToText(node: TipTapNode): string {
	if (node.type === "hardBreak") {
		return "\n";
	}

	if (node.text !== undefined) {
		let text = node.text;
		if (node.marks) {
			for (const mark of node.marks) {
				if (mark.type === "bold") text = `**${text}**`;
				if (mark.type === "italic") text = `_${text}_`;
			}
		}
		return text;
	}
	if (node.content) {
		const separator = node.type === "doc" ? "\n\n" : "";
		return node.content.map((child) => nodeToText(child)).join(separator);
	}
	return "";
}

export function tiptapToPlainText(json: string): string {
	try {
		const doc: TipTapDoc = JSON.parse(json);
		return nodeToText(doc);
	} catch {
		return json;
	}
}

function nodeToRawText(node: TipTapNode): string {
	if (node.type === "hardBreak") {
		return "\n";
	}

	if (node.text !== undefined) {
		return node.text;
	}
	if (node.content) {
		const separator = node.type === "doc" ? "\n\n" : "";
		return node.content.map((child) => nodeToRawText(child)).join(separator);
	}
	return "";
}

export function tiptapToRawText(json: string): string {
	try {
		const doc: TipTapDoc = JSON.parse(json);
		return nodeToRawText(doc);
	} catch {
		return json;
	}
}

export function plainTextToTipTap(text: string): string {
	const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
	const content: TipTapNode[] = paragraphs.map((p) => {
		const lines = p.split("\n");
		const nodes: TipTapNode[] = [];
		for (let i = 0; i < lines.length; i++) {
			nodes.push({ type: "text", text: lines[i] });
			if (i < lines.length - 1) {
				nodes.push({ type: "hardBreak" });
			}
		}
		return { type: "paragraph", content: nodes };
	});

	return JSON.stringify({ type: "doc", content });
}

export function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}
