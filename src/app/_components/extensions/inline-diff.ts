import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { charRangeToPosition, docEndPosition } from "./text-position-mapper";

export interface DiffProposal {
	id: string;
	status: "pending" | "accepted" | "rejected" | "expired";
	operation: "append" | "replace";
	originalText: string | null;
	replacementText: string;
}

export const InlineDiffKey = new PluginKey("inlineDiff");

export interface InlineDiffStorage {
	proposals: DiffProposal[];
	onAccept: (proposalId: string) => void;
	onReject: (proposalId: string) => void;
}

export function createInlineDiffExtension() {
	return Extension.create<{
		proposals: DiffProposal[];
		onAccept: (id: string) => void;
		onReject: (id: string) => void;
	}>({
		name: "inlineDiff",

		addOptions() {
			return {
				proposals: [],
				onAccept: () => {},
				onReject: () => {},
			};
		},

		addProseMirrorPlugins() {
			return [
				new Plugin({
					key: InlineDiffKey,
					props: {
						decorations: (state) => {
							const proposals = this.options.proposals.filter(
								(p) => p.status === "pending",
							);
							if (proposals.length === 0) return DecorationSet.empty;

							const decorations: Decoration[] = [];
							const doc = state.doc;

							for (const proposal of proposals) {
								if (proposal.operation === "replace" && proposal.originalText) {
									const rawText = doc.textContent;
									const matchIndex = rawText.indexOf(proposal.originalText);
									if (matchIndex === -1) continue;

									const startPos = charRangeToPosition(
										doc,
										matchIndex,
										matchIndex + proposal.originalText.length,
									);
									if (!startPos) continue;

									// Deleted text: red strikethrough
									decorations.push(
										Decoration.inline(startPos.from, startPos.to, {
											class: "inline-diff-deleted",
											style:
												"background-color: rgba(180, 60, 40, 0.15); text-decoration: line-through; text-decoration-color: rgba(180, 60, 40, 0.6);",
										}),
									);

									// Inserted text: green background widget after deleted range
									const insertPos = startPos.to;
									const widget = document.createElement("span");
									widget.className = "inline-diff-inserted";
									widget.style.cssText =
										"background-color: rgba(80, 160, 80, 0.15); border-radius: 2px;";
									widget.textContent = proposal.replacementText;
									widget.dataset.proposalId = proposal.id;
									decorations.push(
										Decoration.widget(insertPos, widget, { side: 1 }),
									);
								} else if (proposal.operation === "append") {
									const endPos = docEndPosition(doc);
									const widget = document.createElement("span");
									widget.className = "inline-diff-inserted";
									widget.style.cssText =
										"background-color: rgba(80, 160, 80, 0.15); border-radius: 2px;";
									widget.textContent = proposal.replacementText;
									widget.dataset.proposalId = proposal.id;
									decorations.push(Decoration.widget(endPos, widget));
								}
							}

							return DecorationSet.create(doc, decorations);
						},
					},
				}),
			];
		},
	});
}
