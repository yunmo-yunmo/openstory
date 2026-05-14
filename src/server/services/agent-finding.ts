import "server-only";

import type { ConsistencyIssue } from "../ai/tools/check-consistency";

type AgentFindingDelegate = {
	deleteMany: (args: { where: Record<string, unknown> }) => unknown;
	createMany: (args: { data: AgentFindingCreatePayload[] }) => unknown;
	findMany: (args: {
		where: Record<string, unknown>;
		select: {
			category: true;
			severity: true;
			description: true;
		};
	}) => Promise<
		Array<{
			category: string;
			severity: string;
			description: string;
		}>
	>;
};

type AgentFindingDb = {
	chapter: {
		findFirst: (args: {
			where: {
				id: string;
				projectId: string;
				updatedAt?: Date;
			};
			select: { id: true };
		}) => Promise<{ id: string } | null>;
	};
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
	expectedChapterUpdatedAt?: Date;
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

function issueIdentity(issue: {
	category?: string;
	type?: string;
	severity: string;
	description: string;
}) {
	return [issue.category ?? issue.type ?? "", issue.severity, issue.description]
		.map((part) => part.trim())
		.join("\u0000");
}

export async function persistConsistencyFindings(
	db: AgentFindingDb,
	{
		projectId,
		chapterId,
		issues,
		expectedChapterUpdatedAt,
	}: PersistConsistencyFindingsInput,
) {
	return await db.$transaction(async (tx) => {
		if (expectedChapterUpdatedAt) {
			const currentChapter = await tx.chapter.findFirst({
				where: {
					id: chapterId,
					projectId,
					updatedAt: expectedChapterUpdatedAt,
				},
				select: { id: true },
			});
			if (!currentChapter) {
				return { count: 0, skipped: "stale_chapter" as const };
			}
		}

		const terminalFindings = await tx.agentFinding.findMany({
			where: {
				projectId,
				chapterId,
				type: "consistency_issue",
				source: "background_agent",
				status: { in: ["ignored", "resolved"] },
			},
			select: {
				category: true,
				severity: true,
				description: true,
			},
		});
		const terminalIdentities = new Set(terminalFindings.map(issueIdentity));
		const currentIssues = issues.filter(
			(issue) => !terminalIdentities.has(issueIdentity(issue)),
		);

		await tx.agentFinding.deleteMany({
			where: {
				projectId,
				chapterId,
				...CONSISTENCY_FINDING_FILTER,
			},
		});

		if (currentIssues.length === 0) {
			return { count: 0 };
		}

		return await tx.agentFinding.createMany({
			data: currentIssues.map((issue) =>
				buildFindingCreatePayload(projectId, chapterId, issue),
			),
		});
	});
}
