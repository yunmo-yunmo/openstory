import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface TextPosition {
	from: number;
	to: number;
}

/**
 * Extract raw text from a ProseMirror doc with paragraph separators,
 * matching the server-side `tiptapToRawText` output so char offsets align.
 * Unlike `doc.textContent` (which concatenates without separators), this
 * inserts `\n\n` between top-level blocks — matching how revision proposals
 * are generated.
 */
export function docToRawText(doc: ProseMirrorNode): string {
	const blocks: string[] = [];
	doc.forEach((block) => {
		let text = "";
		block.forEach((node) => {
			if (node.isText) {
				text += node.text ?? "";
			} else if (node.type.name === "hardBreak") {
				text += "\n";
			}
		});
		blocks.push(text);
	});
	return blocks.join("\n\n");
}

/**
 * Map a raw-text character range [startOffset, endOffset) to
 * ProseMirror document positions { from, to }.
 *
 * Uses the same character-counting scheme as `docToRawText` —
 * inserting `\n\n` between top-level blocks — so offsets align
 * with raw-text match positions.
 */
export function charRangeToPosition(
	doc: ProseMirrorNode,
	startOffset: number,
	endOffset: number,
): TextPosition | null {
	let charIndex = 0;
	let from: number | null = null;
	let to: number | null = null;

	doc.forEach((block, blockOffset) => {
		block.forEach((node, relOffset) => {
			if (from !== null && to !== null) return;
			if (!node.isText) return;

			const text = node.text ?? "";
			const nodeStart = charIndex;
			const nodeEnd = charIndex + text.length;
			const absPos = blockOffset + 1 + relOffset;

			if (from === null && nodeEnd > startOffset) {
				const offsetInNode = startOffset - nodeStart;
				from = absPos + Math.max(0, offsetInNode);
			}

			if (to === null && nodeEnd >= endOffset) {
				const offsetInNode = endOffset - nodeStart;
				to = absPos + Math.min(text.length, offsetInNode);
			}

			charIndex = nodeEnd;
		});
		charIndex += 2; // paragraph separator (\n\n)
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
