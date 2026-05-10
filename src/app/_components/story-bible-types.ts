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
