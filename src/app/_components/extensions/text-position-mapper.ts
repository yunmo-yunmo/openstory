import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface TextPosition {
	from: number;
	to: number;
}

/**
 * Map a plain-text character range [startOffset, endOffset) to
 * ProseMirror document positions { from, to }.
 *
 * Walks all text nodes in the document, accumulating character offsets.
 * Handles inline marks (bold/italic) that split text nodes.
 */
export function charRangeToPosition(
	doc: ProseMirrorNode,
	startOffset: number,
	endOffset: number,
): TextPosition | null {
	let charIndex = 0;
	let from: number | null = null;
	let to: number | null = null;

	doc.descendants((node, pos) => {
		if (!node.isText) return true;
		const text = node.text ?? "";
		const nodeStart = charIndex;
		const nodeEnd = charIndex + text.length;

		if (from === null && nodeEnd > startOffset) {
			const offsetInNode = startOffset - nodeStart;
			from = pos + Math.max(0, offsetInNode);
		}

		if (to === null && nodeEnd >= endOffset) {
			const offsetInNode = endOffset - nodeStart;
			to = pos + Math.min(text.length, offsetInNode);
			return false;
		}

		charIndex = nodeEnd;
		return true;
	});

	if (from === null || to === null) return null;
	return { from, to };
}

/**
 * Find the ProseMirror position at the end of the document content.
 */
export function docEndPosition(doc: ProseMirrorNode): number {
	return doc.content.size;
}
