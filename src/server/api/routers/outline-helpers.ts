export type OutlineStatus = "planned" | "writing" | "done";

export type OutlineUpdateInput = {
	title?: string;
	description?: string | null;
	order?: number;
	parentId?: string | null;
	status?: OutlineStatus;
	chapterId?: string | null;
};

type OutlineLabelInput = {
	status: string;
	title: string;
	description?: string | null;
	chapterId?: string | null;
};

type OutlineParent = {
	id: string;
	parentId?: string | null;
};

export function buildOutlineTreeLabel(outline: OutlineLabelInput) {
	const parts = [`[${outline.status}]`, outline.title];

	if (outline.description) {
		parts.push(outline.description);
	}

	if (outline.chapterId) {
		parts.push(`chapter:${outline.chapterId}`);
	}

	return parts.join(" - ");
}

export function buildOutlineUpdateData(input: OutlineUpdateInput) {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	) as Partial<OutlineUpdateInput>;
}

export function wouldCreateOutlineCycle(
	outlines: OutlineParent[],
	outlineId: string,
	nextParentId: string | null | undefined,
) {
	if (!nextParentId) {
		return false;
	}

	if (nextParentId === outlineId) {
		return true;
	}

	const parentById = new Map(
		outlines.map((outline) => [outline.id, outline.parentId ?? null]),
	);
	let currentParentId = parentById.get(nextParentId) ?? null;
	const seen = new Set<string>([nextParentId]);

	while (currentParentId) {
		if (currentParentId === outlineId) {
			return true;
		}

		if (seen.has(currentParentId)) {
			return true;
		}

		seen.add(currentParentId);
		currentParentId = parentById.get(currentParentId) ?? null;
	}

	return false;
}
