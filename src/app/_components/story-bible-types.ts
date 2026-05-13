export const AI_OPERATIONS = [
	{ key: "rewrite", label: "改写" },
	{ key: "polish", label: "润色" },
	{ key: "expand", label: "扩写" },
	{ key: "shorten", label: "缩写" },
	{ key: "continue", label: "续写" },
] as const;

export type AIOperation = (typeof AI_OPERATIONS)[number]["key"];

export const AI_OPERATION_LABELS: Record<AIOperation, string> = {
	rewrite: "改写",
	polish: "润色",
	expand: "扩写",
	shorten: "缩写",
	continue: "续写",
};

export type WorkspaceMode =
	| "chapters"
	| "characters"
	| "outline"
	| "worldNotes";

export const workspaceModes: Array<{
	id: WorkspaceMode;
	label: string;
}> = [
	{ id: "chapters", label: "章节" },
	{ id: "characters", label: "角色" },
	{ id: "outline", label: "大纲" },
	{ id: "worldNotes", label: "世界" },
];
