import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const SelectionTriggerKey = new PluginKey("selectionTrigger");

export interface SelectionData {
	text: string;
	beforeContext: string;
	afterContext: string;
}

export function createSelectionTriggerExtension(
	onSelectionChange: (data: SelectionData | null) => void,
) {
	return Extension.create({
		name: "selectionTrigger",

		addProseMirrorPlugins() {
			return [
				new Plugin({
					key: SelectionTriggerKey,
					view() {
						return {
							update(view) {
								const { from, to } = view.state.selection;
								if (from === to) {
									onSelectionChange(null);
									return;
								}

								const text = view.state.doc.textBetween(from, to);
								const CONTEXT_CHARS = 100;

								const beforeStart = Math.max(0, from - CONTEXT_CHARS);
								const afterEnd = Math.min(
									view.state.doc.content.size,
									to + CONTEXT_CHARS,
								);

								const beforeContext = view.state.doc.textBetween(
									beforeStart,
									from,
								);
								const afterContext = view.state.doc.textBetween(to, afterEnd);

								onSelectionChange({
									text,
									beforeContext,
									afterContext,
								});
							},
						};
					},
				}),
			];
		},
	});
}
