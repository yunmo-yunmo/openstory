"use client";

import {
	ChevronDown,
	ChevronRight,
	MessageSquarePlus,
	Send,
	Sparkles,
	TriangleAlert,
	Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { buildSelectionMessage, isSendDisabled } from "./chat-panel-helpers";
import type { DiffProposal } from "./extensions/inline-diff";
import type { SelectionData } from "./extensions/selection-trigger";
import type { AIOperation } from "./selection-menu";
import {
	AI_OPERATION_LABELS,
	hasRevisionEditIntent,
} from "./story-bible-types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface SessionMessage {
	role: string;
	content: string;
	proposalId?: string;
	toolCalls?: Array<{
		name: string;
		args: Record<string, unknown>;
	}>;
	toolResults?: Array<{
		name: string;
		result: unknown;
	}>;
}

type ProposalStatus = "pending" | "accepted" | "rejected" | "expired";
type ProposalOperation = "append" | "replace";

interface ProposalType {
	id: string;
	status: ProposalStatus;
	operation: ProposalOperation;
	instruction: string;
	targetHint: string | null;
	originalText: string | null;
	replacementText: string | null;
	createdAt: Date;
	decidedAt: Date | null;
}

type FindingSeverity = "high" | "medium" | "low";

interface AgentFinding {
	id: string;
	severity: string;
	title: string;
	description: string;
	locations: unknown | null;
}

const severityLabels: Record<FindingSeverity, string> = {
	high: "高",
	medium: "中",
	low: "低",
};

const severityTone: Record<FindingSeverity, "danger" | "brass" | "muted"> = {
	high: "danger",
	medium: "brass",
	low: "muted",
};

const severityRank: Record<FindingSeverity, number> = {
	high: 3,
	medium: 2,
	low: 1,
};

export type { DiffProposal } from "./extensions/inline-diff";

export function ChatPanel({
	projectId,
	chapterId,
	activeSessionId,
	onSessionChange,
	onOpenModelServices,
	onProposalsChange,
	pendingSelection,
	onSelectionConsumed,
}: {
	projectId: string;
	chapterId: string | null;
	activeSessionId: string | null;
	onSessionChange: (id: string | null) => void;
	onOpenModelServices?: () => void;
	onProposalsChange?: (proposals: DiffProposal[]) => void;
	pendingSelection?: {
		operation: AIOperation;
		selection: SelectionData;
	} | null;
	onSelectionConsumed?: () => void;
}) {
	const utils = api.useUtils();

	const createSessionMutation = api.session.create.useMutation({
		onSuccess: (newSession) => {
			void utils.session.list.invalidate({ projectId });
			onSessionChange(newSession.id);
		},
	});

	const handleNewChat = useCallback(() => {
		if (createSessionMutation.isPending || !chapterId) return;
		createSessionMutation.mutate({
			projectId,
			chapterId,
		});
	}, [projectId, chapterId, createSessionMutation]);

	if (!chapterId && !activeSessionId) {
		return (
			<aside className="flex min-h-screen flex-col border-study-600 bg-study-800/95 lg:border-l">
				<div className="flex flex-1 items-center justify-center px-6">
					<div className="flex max-w-xs flex-col items-center gap-4 text-center">
						<Sparkles aria-hidden="true" className="h-10 w-10 text-amber" />
						<div>
							<p className="font-display text-2xl text-ink">打开一个章节开始</p>
							<p className="mt-2 text-ink-dim text-sm leading-relaxed">
								先在中间的书页里选中一章，再让助手进入对话。
							</p>
						</div>
					</div>
				</div>
			</aside>
		);
	}

	return (
		<ChatPanelInner
			activeSessionId={activeSessionId}
			chapterId={chapterId}
			createSessionMutation={createSessionMutation}
			onNewChat={handleNewChat}
			onOpenModelServices={onOpenModelServices}
			onProposalsChange={onProposalsChange}
			onSelectionConsumed={onSelectionConsumed}
			onSessionChange={onSessionChange}
			pendingSelection={pendingSelection}
			projectId={projectId}
		/>
	);
}

function ChatPanelInner({
	projectId,
	activeSessionId,
	createSessionMutation,
	chapterId,
	onSessionChange,
	onNewChat,
	onOpenModelServices,
	onProposalsChange,
	pendingSelection,
	onSelectionConsumed,
}: {
	projectId: string;
	activeSessionId: string | null;
	createSessionMutation: { isPending: boolean };
	chapterId: string | null;
	onSessionChange: (id: string | null) => void;
	onNewChat: () => void;
	onOpenModelServices?: () => void;
	onProposalsChange?: (proposals: DiffProposal[]) => void;
	pendingSelection?: {
		operation: AIOperation;
		selection: SelectionData;
	} | null;
	onSelectionConsumed?: () => void;
}) {
	const [input, setInput] = useState("");
	const [areFindingsExpanded, setAreFindingsExpanded] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const utils = api.useUtils();
	const [modelStatus] = api.llmConfig.status.useSuspenseQuery();
	const hasUsableConfig = modelStatus.hasUsableConfig;

	const { data: sessionData } = api.session.getById.useQuery(
		{ id: activeSessionId ?? "" },
		{ enabled: !!activeSessionId },
	);

	const messages: SessionMessage[] = sessionData
		? (sessionData.messages as SessionMessage[])
		: [];
	const canGenerateFindingRevision =
		!!chapterId && sessionData?.chapterId === chapterId;

	const { data: proposalsData } = api.revisionProposal.listBySession.useQuery(
		{ sessionId: activeSessionId ?? "" },
		{ enabled: !!activeSessionId },
	);

	const { data: findingsData } = api.agentFinding.listByChapter.useQuery(
		{ chapterId: chapterId ?? "" },
		{ enabled: !!chapterId, refetchInterval: chapterId ? 5000 : false },
	);

	const findings = (findingsData ?? []) as AgentFinding[];
	const highestSeverity = getHighestSeverity(findings);

	const proposalsMap = useMemo(() => {
		const map = new Map<string, ProposalType>();
		for (const raw of proposalsData ?? []) {
			map.set(raw.id, {
				...raw,
				status: raw.status as ProposalStatus,
				operation: raw.operation as ProposalOperation,
			});
		}
		return map;
	}, [proposalsData]);

	useEffect(() => {
		if (onProposalsChange) {
			const pending = Array.from(proposalsMap.values()) as DiffProposal[];
			onProposalsChange(pending);
		}
	}, [proposalsMap, onProposalsChange]);

	const sendMutation = api.session.send.useMutation({
		onSuccess: () => {
			setInput("");
			if (activeSessionId) {
				void utils.session.getById.invalidate({ id: activeSessionId });
			}
			void utils.session.list.invalidate({ projectId });
			if (activeSessionId) {
				void utils.revisionProposal.listBySession.invalidate({
					sessionId: activeSessionId,
				});
			}
			if (chapterId) {
				void utils.agentFinding.listByChapter.invalidate({ chapterId });
			}
		},
	});

	const ignoreFindingMutation = api.agentFinding.ignore.useMutation({
		onSuccess: () => {
			if (chapterId) {
				void utils.agentFinding.listByChapter.invalidate({ chapterId });
			}
		},
	});

	const resolveFindingMutation = api.agentFinding.resolve.useMutation({
		onSuccess: () => {
			if (chapterId) {
				void utils.agentFinding.listByChapter.invalidate({ chapterId });
			}
		},
	});

	const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
	const scrollTrigger = `${messages.length}:${sendMutation.isPending}:${streamingMessage ?? ""}`;

	useEffect(() => {
		void scrollTrigger;
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [scrollTrigger]);

	useEffect(() => {
		if (!pendingSelection || !hasUsableConfig || sendMutation.isPending) return;

		if (activeSessionId) {
			const message = buildSelectionMessage({
				operationLabel: AI_OPERATION_LABELS[pendingSelection.operation],
				operation: pendingSelection.operation,
				selectedText: pendingSelection.selection.text,
			});
			sendMutation.mutate({
				id: activeSessionId,
				message,
				selectionContext: {
					selectedText: pendingSelection.selection.text,
					beforeContext: pendingSelection.selection.beforeContext,
					afterContext: pendingSelection.selection.afterContext,
					operation: pendingSelection.operation,
				},
			});
			onSelectionConsumed?.();
		}
	}, [
		pendingSelection,
		activeSessionId,
		hasUsableConfig,
		sendMutation.mutate,
		sendMutation.isPending,
		onSelectionConsumed,
	]);

	const adjustTextareaHeight = useCallback(() => {
		const ta = textareaRef.current;
		if (!ta) return;
		ta.style.height = "auto";
		ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
	}, []);

	useEffect(() => {
		adjustTextareaHeight();
	}, [adjustTextareaHeight]);

	const handleSend = useCallback(async () => {
		const trimmed = input.trim();
		if (
			!trimmed ||
			!activeSessionId ||
			sendMutation.isPending ||
			!hasUsableConfig ||
			streamingMessage !== null
		)
			return;

		if (hasRevisionEditIntent(trimmed)) {
			sendMutation.mutate({ id: activeSessionId, message: trimmed });
			return;
		}

		setInput("");
		setStreamingMessage("");

		try {
			const response = await fetch("/api/chat/stream", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: trimmed,
					sessionId: activeSessionId,
					projectId,
				}),
			});

			if (!response.ok || !response.body) {
				setStreamingMessage(null);
				sendMutation.mutate({ id: activeSessionId, message: trimmed });
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let fullText = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				fullText += decoder.decode(value, { stream: true });
				setStreamingMessage(fullText);
			}

			setStreamingMessage(null);
			void utils.session.getById.invalidate({ id: activeSessionId });
			void utils.session.list.invalidate({ projectId });
		} catch {
			setStreamingMessage(null);
			sendMutation.mutate({ id: activeSessionId, message: trimmed });
		}
	}, [
		input,
		activeSessionId,
		sendMutation,
		hasUsableConfig,
		streamingMessage,
		projectId,
		utils,
	]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleGenerateRevision = useCallback(
		(finding: AgentFinding) => {
			if (
				!hasUsableConfig ||
				!activeSessionId ||
				!canGenerateFindingRevision ||
				sendMutation.isPending ||
				streamingMessage !== null
			) {
				return;
			}

			const locationsText = formatFindingLocations(finding.locations);
			const message = [
				"请根据下面的一致性发现生成一个结构化修订提案，用于修改当前章节。",
				`发现：${finding.title}`,
				`说明：${finding.description}`,
				locationsText ? `位置：${locationsText}` : null,
				"请优先保持原有文风，只给出可应用到章节正文的改写或补写建议。",
			]
				.filter(Boolean)
				.join("\n");

			sendMutation.mutate({ id: activeSessionId, message });
		},
		[
			activeSessionId,
			canGenerateFindingRevision,
			hasUsableConfig,
			sendMutation,
			streamingMessage,
		],
	);

	return (
		<aside className="flex min-h-screen flex-col border-study-600 bg-study-800/95 lg:border-l">
			<div className="flex shrink-0 items-center justify-between gap-3 border-study-600 border-b px-5 py-4">
				<div className="min-w-0">
					<p className="truncate font-display text-ink text-xl">
						{sessionData?.title ?? "新对话"}
					</p>
					<p className="font-mono text-[10px] text-ink-dim uppercase tracking-[0.2em]">
						已关联当前章节
					</p>
				</div>
				<Button
					aria-label="新对话"
					onClick={() => onSessionChange(null)}
					size="icon"
					type="button"
					variant="quiet"
				>
					<Send aria-hidden="true" className="h-4 w-4 rotate-45" />
				</Button>
			</div>

			{!hasUsableConfig && (
				<div className="border-amber/30 border-b bg-amber/5 px-5 py-4">
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2">
							<TriangleAlert
								aria-hidden="true"
								className="h-4 w-4 text-amber"
							/>
							<p className="font-label text-[10px] text-amber uppercase tracking-[0.24em]">
								未配置模型服务
							</p>
						</div>
						<p className="text-ink-dim text-xs leading-relaxed">
							配置 AI 提供商后即可开始与写作助手对话。
						</p>
						{onOpenModelServices && (
							<Button
								onClick={onOpenModelServices}
								size="sm"
								type="button"
								variant="secondary"
							>
								<Wand2 aria-hidden="true" className="h-4 w-4" />
								配置模型服务
							</Button>
						)}
					</div>
				</div>
			)}

			{findings.length > 0 && highestSeverity && (
				<div className="border-amber/20 border-b bg-study-700/35 px-5 py-3">
					<div className="flex items-center justify-between gap-3">
						<button
							aria-controls="chapter-findings-list"
							aria-expanded={areFindingsExpanded}
							className="flex min-w-0 items-center gap-2 text-left"
							onClick={() => setAreFindingsExpanded((value) => !value)}
							type="button"
						>
							{areFindingsExpanded ? (
								<ChevronDown
									aria-hidden="true"
									className="h-4 w-4 shrink-0 text-amber"
								/>
							) : (
								<ChevronRight
									aria-hidden="true"
									className="h-4 w-4 shrink-0 text-amber"
								/>
							)}
							<span className="truncate font-label text-[10px] text-ink-muted uppercase tracking-[0.2em]">
								章节发现 {findings.length} 条
							</span>
						</button>
						<Badge tone={severityTone[highestSeverity]}>
							最高 {severityLabels[highestSeverity]}
						</Badge>
					</div>

					{areFindingsExpanded && (
						<div className="mt-3 space-y-3" id="chapter-findings-list">
							{findings.map((finding) => {
								const severity = normalizeSeverity(finding.severity);
								const locationsText = formatFindingLocations(finding.locations);
								const statusActionDisabled =
									ignoreFindingMutation.isPending ||
									resolveFindingMutation.isPending ||
									sendMutation.isPending;
								const generateDisabled =
									!hasUsableConfig ||
									!canGenerateFindingRevision ||
									sendMutation.isPending ||
									streamingMessage !== null;

								return (
									<div
										className="border-study-600 border-t pt-3 first:border-t-0 first:pt-0"
										key={finding.id}
									>
										<div className="mb-2 flex items-center justify-between gap-2">
											<p className="min-w-0 truncate text-ink text-sm">
												{finding.title}
											</p>
											<Badge tone={severityTone[severity]}>
												{severityLabels[severity]}
											</Badge>
										</div>
										<p className="text-ink-dim text-xs leading-relaxed">
											{finding.description}
										</p>
										{locationsText && (
											<p className="mt-1 font-mono text-[11px] text-ink-dim">
												位置：{locationsText}
											</p>
										)}
										<div className="mt-2 flex flex-wrap gap-2">
											<Button
												disabled={statusActionDisabled}
												onClick={() =>
													ignoreFindingMutation.mutate({ id: finding.id })
												}
												size="sm"
												type="button"
												variant="quiet"
											>
												忽略
											</Button>
											<Button
												disabled={statusActionDisabled}
												onClick={() =>
													resolveFindingMutation.mutate({ id: finding.id })
												}
												size="sm"
												type="button"
												variant="quiet"
											>
												已解决
											</Button>
											<Button
												disabled={generateDisabled}
												onClick={() => handleGenerateRevision(finding)}
												size="sm"
												title={
													canGenerateFindingRevision
														? undefined
														: "当前对话未绑定本章"
												}
												type="button"
												variant="secondary"
											>
												生成修订
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
				{!activeSessionId ? (
					<div className="flex min-h-[320px] items-center justify-center px-1 py-10">
						<div className="flex max-w-xs flex-col items-center gap-4 text-center">
							<MessageSquarePlus
								aria-hidden="true"
								className="h-12 w-12 text-amber/70"
							/>
							<div>
								<p className="font-display text-2xl text-ink">
									与 AI 写作助手开始对话
								</p>
								<p className="mt-2 text-ink-dim text-sm leading-relaxed">
									讨论灵感、获取反馈、寻求建议。
								</p>
							</div>
							<Button
								disabled={createSessionMutation.isPending}
								onClick={onNewChat}
								size="lg"
								type="button"
							>
								<Send aria-hidden="true" className="h-4 w-4" />
								{createSessionMutation.isPending ? "创建中..." : "新对话"}
							</Button>
						</div>
					</div>
				) : (
					messages.length === 0 &&
					!sendMutation.isPending && (
						<div className="py-10 text-center">
							<p className="text-ink-dim text-xs italic">
								与助手分享你的第一个想法
							</p>
						</div>
					)
				)}

				{messages.map((msg) => {
					const proposal = msg.proposalId
						? proposalsMap.get(msg.proposalId)
						: undefined;
					return (
						<div key={getMessageKey(msg) + (proposal?.status ?? "")}>
							<MessageBubble message={msg} />
							{proposal && <RevisionProposalCard proposal={proposal} />}
						</div>
					);
				})}

				{streamingMessage !== null && (
					<MessageBubble
						message={{ content: streamingMessage, role: "assistant" }}
					/>
				)}

				{sendMutation.isPending && (
					<Card className="mb-3 border-amber/30 bg-amber/5 px-4 py-3">
						<div className="flex items-center gap-2">
							<span className="text-ink-muted text-sm">思考中</span>
							<span className="flex gap-0.5 pt-0.5">
								<span className="h-1 w-1 animate-pulse rounded-full bg-amber" />
								<span
									className="h-1 w-1 animate-pulse rounded-full bg-amber"
									style={{ animationDelay: "0.15s" }}
								/>
								<span
									className="h-1 w-1 animate-pulse rounded-full bg-amber"
									style={{ animationDelay: "0.3s" }}
								/>
							</span>
						</div>
					</Card>
				)}

				{sendMutation.error && (
					<Card className="mb-3 border-rust/30 bg-rust/10 px-4 py-3 text-rust-light text-xs">
						{sendMutation.error.message ?? "发送失败"}
					</Card>
				)}

				<div ref={messagesEndRef} />
			</div>

			<div className="shrink-0 border-study-600 border-t p-4">
				<div className="flex items-end gap-2">
					<textarea
						className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm placeholder:text-ink-dim/70 focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/20 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!activeSessionId || !hasUsableConfig}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={
							hasUsableConfig
								? activeSessionId
									? "给助手发消息..."
									: "先创建对话后再发送消息..."
								: "请先配置模型服务才能发送消息..."
						}
						ref={textareaRef}
						rows={1}
						value={input}
					/>
					<Button
						aria-label="发送消息"
						disabled={isSendDisabled({
							hasUsableConfig: !!activeSessionId && hasUsableConfig,
							input,
							isMutationPending: sendMutation.isPending,
							isStreaming: streamingMessage !== null,
						})}
						onClick={handleSend}
						size="icon"
						type="button"
					>
						<Send aria-hidden="true" className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</aside>
	);
}

function getMessageKey(message: SessionMessage) {
	return [
		message.role,
		message.content,
		JSON.stringify(message.toolCalls ?? []),
		JSON.stringify(message.toolResults ?? []),
	].join(":");
}

function normalizeSeverity(severity: string): FindingSeverity {
	return severity === "high" || severity === "medium" || severity === "low"
		? severity
		: "low";
}

function getHighestSeverity(findings: AgentFinding[]): FindingSeverity | null {
	let highest: FindingSeverity | null = null;
	for (const finding of findings) {
		const severity = normalizeSeverity(finding.severity);
		if (!highest || severityRank[severity] > severityRank[highest]) {
			highest = severity;
		}
	}
	return highest;
}

function formatFindingLocations(locations: unknown): string | null {
	if (locations == null) return null;
	if (typeof locations === "string") return locations.trim() || null;
	if (Array.isArray(locations)) {
		const text = locations
			.map((location) => formatLocationItem(location))
			.filter(Boolean)
			.join("；");
		return text || null;
	}
	return formatLocationItem(locations);
}

function formatLocationItem(location: unknown): string {
	if (location == null) return "";
	if (typeof location === "string") return location.trim();
	if (typeof location === "number" || typeof location === "boolean") {
		return String(location);
	}
	if (typeof location !== "object") return "";

	const record = location as Record<string, unknown>;
	const chapter = getLocationValue(record, [
		"chapterTitle",
		"chapter",
		"chapterId",
	]);
	const paragraph = getLocationValue(record, [
		"paragraph",
		"paragraphIndex",
		"paragraphNumber",
	]);
	const quote = getLocationValue(record, ["quote", "text", "snippet"]);
	const line = getLocationValue(record, ["line", "lineNumber"]);
	const parts = [
		chapter,
		paragraph ? `段落 ${paragraph}` : null,
		line ? `行 ${line}` : null,
		quote ? `“${quote}”` : null,
	].filter(Boolean);

	return parts.length > 0 ? parts.join("，") : JSON.stringify(location);
}

function getLocationValue(
	record: Record<string, unknown>,
	keys: string[],
): string | null {
	for (const key of keys) {
		const value = record[key];
		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			const text = String(value).trim();
			if (text) return text;
		}
	}
	return null;
}

function MessageBubble({ message }: { message: SessionMessage }) {
	const [showTools, setShowTools] = useState(false);
	const isUser = message.role === "user";
	const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

	return (
		<div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[90%] rounded border px-4 py-3 text-sm leading-relaxed ${
					isUser
						? "border-amber/30 bg-amber/10 text-ink"
						: "border-study-600 bg-study-700/60 text-ink"
				}`}
			>
				<p className="whitespace-pre-wrap">{message.content}</p>

				{hasToolCalls && (
					<div className="mt-3 border-study-600 border-t pt-2">
						<button
							className="flex items-center gap-1.5 font-mono text-amber text-xs transition-colors hover:text-amber-light"
							onClick={() => setShowTools(!showTools)}
							type="button"
						>
							<svg
								aria-hidden="true"
								className={`h-3 w-3 transition-transform ${showTools ? "rotate-90" : ""}`}
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M9 5l7 7-7 7"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							使用工具：{message.toolCalls?.map((tc) => tc.name).join(", ")}
						</button>
						{showTools && (
							<div className="mt-2 space-y-1.5">
								{message.toolCalls?.map((tc) => (
									<div
										className="rounded border border-study-600 bg-study-800 px-2.5 py-1.5 font-mono text-ink-dim text-xs"
										key={`${tc.name}-${JSON.stringify(tc.args)}`}
									>
										<span className="text-amber">{tc.name}</span>(
										{JSON.stringify(tc.args)})
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function RevisionProposalCard({ proposal }: { proposal: ProposalType }) {
	const isPending = proposal.status === "pending";

	const operationLabel: Record<ProposalOperation, string> = {
		append: "追加提案",
		replace: "替换提案",
	};

	const statusLabel: Record<ProposalStatus, string> = {
		pending: "待采纳",
		accepted: "已采纳",
		rejected: "已拒绝",
		expired: "已过期",
	};

	const statusTone: Record<
		ProposalStatus,
		"brass" | "sage" | "danger" | "muted"
	> = {
		pending: "brass",
		accepted: "sage",
		rejected: "danger",
		expired: "muted",
	};

	let preview: string | null = null;
	if (proposal.operation === "replace") {
		const source = proposal.targetHint ?? proposal.originalText;
		if (source) {
			preview = source.length > 80 ? `${source.slice(0, 80)}...` : source;
		}
	} else if (proposal.operation === "append" && proposal.replacementText) {
		const text = proposal.replacementText;
		preview = text.length > 80 ? `${text.slice(0, 80)}...` : text;
	}

	return (
		<Card className="mb-3 border-l-2 border-l-amber/60 px-3 py-3">
			<div className="mb-2 flex items-center gap-2">
				<Badge tone={statusTone[proposal.status]}>
					{operationLabel[proposal.operation]}
				</Badge>
				<Badge tone="muted">{statusLabel[proposal.status]}</Badge>
			</div>
			<p className="text-ink-muted text-sm leading-relaxed">
				{proposal.instruction}
			</p>
			{preview && (
				<p className="mt-2 font-mono text-ink-dim text-xs italic">{preview}</p>
			)}
			{isPending && (
				<p className="mt-2 text-ink-dim text-xs italic">
					在编辑器中查看修改建议
				</p>
			)}
		</Card>
	);
}
