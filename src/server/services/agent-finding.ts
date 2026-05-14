import "server-only";

import type { ConsistencyIssue } from "../ai/tools/check-consistency";

type AgentFindingDelegate = {
	deleteMany: (args: { where: Record<string, unknown> }) => unknown;
	createMany: (args: {
		data: AgentFindingCreatePayload[];
	}) => unknown;
};

type AgentFindingDb = {
	agentFinding: AgentFindingDelegate;
	$transaction: <T>(fn: (tx: AgentFindingDb) => T | Promise<T>) => Promise<T>;
};

type AgentFindingCreatePayload = {
	projectId: string;
	chapterId: string;
	type: "consistency_issue";
	category: ConsistencyIssue["type"];
	severity: ConsistencyIssue["severity"];
	title: string;
	description: string;
	locations: string[];
	status: "open";
	source: "background_agent";
};

type PersistConsistencyFindingsInput = {
	projectId: string;
	chapterId: string;
	issues: ConsistencyIssue[];
};

type FindingPromptInput = {
	description: string;
	locations?: unknown;
};

const CONSISTENCY_FINDING_FILTER = {
	type: "consistency_issue",
	source: "background_agent",
	status: "open",
} as const;

function buildFindingTitle(description: string): string {
	const trimmed = description.trim();
	if (trimmed.length <= 80) {
		return trimmed;
	}

	return `${trimmed.slice(0, 80).trim()}...`;
}

function buildFindingCreatePayload(
	projectId: string,
	chapterId: string,
	issue: ConsistencyIssue,
): AgentFindingCreatePayload {
	return {
		projectId,
		chapterId,
		type: "consistency_issue",
		category: issue.type,
		severity: issue.severity,
		title: buildFindingTitle(issue.description),
		description: issue.description,
		locations: issue.locations,
		status: "open",
		source: "background_agent",
	};
}

export async function persistConsistencyFindings(
	db: AgentFindingDb,
	{ projectId, chapterId, issues }: PersistConsistencyFindingsInput,
) {
	return await db.$transaction(async (tx) => {
		await tx.agentFinding.deleteMany({
			where: {
				projectId,
				chapterId,
				...CONSISTENCY_FINDING_FILTER,
			},
		});

		if (issues.length === 0) {
			return { count: 0 };
		}

		return await tx.agentFinding.createMany({
			data: issues.map((issue) =>
				buildFindingCreatePayload(projectId, chapterId, issue),
			),
		});
	});
}

export function buildFindingRevisionPrompt(finding: FindingPromptInput): string {
	const locations = Array.isArray(finding.locations)
		? finding.locations.map(String).filter(Boolean).join("、")
		: "";

	return [
		"请根据以下一致性问题修改当前章节，保持原有文风并生成可接受的修订方案。",
		`问题描述：${finding.description}`,
		`相关位置：${locations || "未标注"}`,
	].join("\n");
}
