"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasRevisionEditIntent } from "~/server/services/revision-proposal";
import { api } from "~/trpc/react";
import type { DiffProposal } from "./extensions/inline-diff";
import type { SelectionData } from "./extensions/selection-trigger";
import type { AIOperation } from "./selection-menu";
import { AI_OPERATION_LABELS } from "./story-bible-types";

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

export type { DiffProposal } from "./extensions/inline-diff";

export function ChatPanel({
	projectId,
	chapterId,
	activeSessionId,
	onSessionChange,
	onOpenModelServices,
	onProposalsChange,
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

	// State 1: No chapter selected
	if (!chapterId) {
		return (
			<aside className="flex w-[380px] shrink-0 flex-col border-study-600 border-l bg-study-800">
				<div className="flex flex-1 items-center justify-center px-6">
					<div className="flex flex-col items-center gap-3 text-center">
						<svg
							aria-hidden="true"
							className="h-10 w-10 text-ink-dim"
							fill="none"
							stroke="currentColor"
							strokeWidth={1.5}
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<p className="font-sans text-ink-dim text-sm">打开一个章节开始</p>
					</div>
				</div>
			</aside>
		);
	}

	// State 2: Chapter selected, but no active session
	if (!activeSessionId) {
		return (
			<aside className="flex w-[380px] shrink-0 flex-col border-study-600 border-l bg-study-800">
				<div className="flex flex-1 items-center justify-center px-6">
					<div className="flex flex-col items-center gap-4 text-center">
						<svg
							aria-hidden="true"
							className="h-12 w-12 text-amber/30"
							fill="none"
							stroke="currentColor"
							strokeWidth={1}
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
						</svg>
						<div>
							<p className="font-sans text-ink-muted text-sm">
								与 AI 写作助手开始对话
							</p>
							<p className="mt-1 font-sans text-ink-dim text-xs">
								讨论灵感、获取反馈、寻求建议
							</p>
						</div>
						<button
							className="inline-flex items-center gap-2 rounded-sm border border-amber/40 bg-amber/10 px-5 py-2.5 font-sans text-amber text-sm transition-all duration-300 hover:border-amber hover:bg-amber/20 hover:shadow-[0_0_20px_var(--color-amber-glow)]"
							disabled={createSessionMutation.isPending}
							onClick={handleNewChat}
							type="button"
						>
							<svg
								aria-hidden="true"
								className="h-4 w-4"
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M12 5v14m-7-7h14"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							{createSessionMutation.isPending ? "创建中..." : "新对话"}
						</button>
					</div>
				</div>
			</aside>
		);
	}

	// State 3: Active session
	return (
		<ChatPanelInner
			activeSessionId={activeSessionId}
			chapterId={chapterId}
			onOpenModelServices={onOpenModelServices}
			onSessionChange={onSessionChange}
			projectId={projectId}
		/>
	);
}

function ChatPanelInner({
	projectId,
	activeSessionId,
	chapterId,
	onSessionChange,
	onOpenModelServices,
	onProposalsChange,
	pendingSelection,
	onSelectionConsumed,
}: {
	projectId: string;
	activeSessionId: string;
	chapterId: string | null;
	onSessionChange: (id: string | null) => void;
	onOpenModelServices?: () => void;
	onProposalsChange?: (proposals: DiffProposal[]) => void;
	pendingSelection?: {
		operation: AIOperation;
		selection: SelectionData;
	} | null;
	onSelectionConsumed?: () => void;
}) {
	const [input, setInput] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const utils = api.useUtils();

	// Check model config status
	const [modelStatus] = api.llmConfig.status.useSuspenseQuery();
	const hasUsableConfig = modelStatus.hasUsableConfig;

	// Load active session messages
	const [sessionData] = api.session.getById.useSuspenseQuery({
		id: activeSessionId,
	});

	const messages: SessionMessage[] = sessionData
		? (sessionData.messages as SessionMessage[])
		: [];

	// Revision proposals
	const { data: proposalsData } = api.revisionProposal.listBySession.useQuery(
		{ sessionId: activeSessionId },
		{ enabled: !!activeSessionId },
	);

	const proposalsMap = useMemo(() => {
		const map = new Map<string, ProposalType>();
		for (const raw of proposalsData ?? []) {
			const p: ProposalType = {
				...raw,
				status: raw.status as ProposalStatus,
				operation: raw.operation as ProposalOperation,
			};
			map.set(p.id, p);
		}
		return map;
	}, [proposalsData]);

	// Propagate proposals to editor for inline diff
	useEffect(() => {
		if (onProposalsChange) {
			const pending = Array.from(proposalsMap.values()) as DiffProposal[];
			onProposalsChange(pending);
		}
	}, [proposalsMap, onProposalsChange]);

	// Mutations
	const sendMutation = api.session.send.useMutation({
		onSuccess: () => {
			setInput("");
			void utils.session.getById.invalidate({ id: activeSessionId });
			void utils.session.list.invalidate({ projectId });
		},
	});

	const [streamingMessage, setStreamingMessage] = useState<string | null>(null);

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Auto-send when pendingSelection arrives (from editor selection menu)
	useEffect(() => {
		if (!pendingSelection || !hasUsableConfig || sendMutation.isPending) return;

		if (activeSessionId) {
			const message =
				AI_OPERATION_LABELS[pendingSelection.operation] +
				(pendingSelection.operation === "continue" ? "" : "选中的文字") +
				"：" +
				pendingSelection.selection.text.slice(0, 50) +
				"...";
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
		} else if (chapterId) {
			onSelectionConsumed?.();
		}
	}, [
		pendingSelection,
		activeSessionId,
		hasUsableConfig,
		sendMutation.mutate,
		sendMutation.isPending,
		onSelectionConsumed,
		chapterId,
	]);

	// Auto-resize textarea
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
			sendMutation.isPending ||
			!hasUsableConfig ||
			streamingMessage !== null
		)
			return;

		// Check if this is an edit-intent message (revision proposal path)
		if (hasRevisionEditIntent(trimmed)) {
			sendMutation.mutate({ id: activeSessionId, message: trimmed });
			return;
		}

		// Streaming path for general chat
		setInput("");
		setStreamingMessage("");

		try {
			// Build full message history for the API
			const allMessages = [
				...(sessionData?.messages ?? []),
				{ role: "user", content: trimmed },
			];

			const response = await fetch("/api/chat/stream", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: allMessages,
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
			// Messages are persisted server-side by the streaming endpoint.
			// Refetch to pick up the saved messages.
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
		sessionData,
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

	return (
		<aside className="flex w-[380px] shrink-0 flex-col border-study-600 border-l bg-study-800">
			{/* Header */}
			<div className="flex shrink-0 items-center gap-3 border-study-600 border-b px-4 py-3">
				<div className="min-w-0 flex-1">
					<p className="truncate font-sans text-ink text-sm">
						{sessionData?.title ?? "新对话"}
					</p>
					<p className="font-mono text-ink-dim text-xs">已关联当前章节</p>
				</div>
				<button
					aria-label="新对话"
					className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-dim transition-colors hover:bg-study-700 hover:text-ink-muted"
					onClick={() => onSessionChange(null)}
					type="button"
				>
					<svg
						aria-hidden="true"
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 5v14m-7-7h14"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
			</div>

			{/* Model config warning */}
			{!hasUsableConfig && (
				<div className="shrink-0 border-amber/30 border-b bg-amber/5 px-4 py-3">
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<svg
								aria-hidden="true"
								className="h-4 w-4 shrink-0 text-amber"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							<p className="font-sans text-amber text-xs">未配置模型服务</p>
						</div>
						<p className="font-sans text-ink-dim text-xs leading-relaxed">
							配置 AI 提供商后即可开始与写作助手对话。
						</p>
						{onOpenModelServices && (
							<button
								className="inline-flex w-fit items-center gap-1.5 rounded-sm border border-amber/40 bg-amber/10 px-3 py-1.5 font-sans text-amber text-xs transition-colors hover:border-amber hover:bg-amber/20"
								onClick={onOpenModelServices}
								type="button"
							>
								配置模型服务
							</button>
						)}
					</div>
				</div>
			)}

			{/* Message list */}
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
				{messages.length === 0 && !sendMutation.isPending && (
					<p className="py-8 text-center font-sans text-ink-dim text-xs italic">
						与助手分享你的第一个想法
					</p>
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

				{/* Thinking indicator */}
				{sendMutation.isPending && (
					<div className="mb-3 flex items-center gap-1.5 rounded-sm bg-study-700/80 px-4 py-3">
						<span className="font-sans text-ink-muted text-sm">思考中</span>
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
				)}

				{sendMutation.error && (
					<div className="mb-3 rounded-sm border border-rust/30 bg-rust/10 px-4 py-2 font-sans text-rust text-xs">
						{sendMutation.error.message ?? "发送失败"}
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input area */}
			<div className="shrink-0 border-study-600 border-t p-3">
				<div className="flex items-end gap-2">
					<textarea
						className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm placeholder:text-ink-dim focus:border-amber/50 focus:outline-none focus:ring-1 focus:ring-amber/30 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!hasUsableConfig}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={
							hasUsableConfig
								? "给助手发消息..."
								: "请先配置模型服务才能发送消息..."
						}
						ref={textareaRef}
						rows={1}
						value={input}
					/>
					<button
						aria-label="发送消息"
						className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border transition-all ${
							input.trim() && !sendMutation.isPending && hasUsableConfig
								? "border-amber/40 bg-amber/10 text-amber hover:border-amber hover:bg-amber/20"
								: "border-study-600 bg-study-700 text-ink-dim"
						}`}
						disabled={
							!input.trim() || sendMutation.isPending || !hasUsableConfig
						}
						onClick={handleSend}
						type="button"
					>
						<svg
							aria-hidden="true"
							className="h-4 w-4"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M12 19V5m-7 7l7-7 7 7"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
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

function MessageBubble({ message }: { message: SessionMessage }) {
	const [showTools, setShowTools] = useState(false);
	const isUser = message.role === "user";
	const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

	return (
		<div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[90%] rounded-sm px-4 py-2.5 font-sans text-sm leading-relaxed ${
					isUser
						? "bg-study-700 text-ink"
						: "border border-study-600/50 bg-study-700/60 text-ink"
				}`}
			>
				{/* Message content */}
				<p className="whitespace-pre-wrap">{message.content}</p>

				{/* Tool calls */}
				{hasToolCalls && (
					<div className="mt-2 border-study-600 border-t pt-2">
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
								{message.toolCalls?.map((tc, _idx) => (
									<div
										className="rounded-sm bg-study-800 px-2.5 py-1.5 font-mono text-ink-dim text-xs"
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

	const statusColor: Record<ProposalStatus, string> = {
		pending: "text-amber",
		accepted: "text-sage",
		rejected: "text-rust",
		expired: "text-ink-dim",
	};

	// Build preview text
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
		<div className="mb-3 ml-0 border-amber/40 border-l-2 bg-study-700/40 px-3 py-2.5">
			{/* Header: operation badge + status badge */}
			<div className="mb-1.5 flex items-center gap-2">
				<span className="rounded-sm bg-amber/15 px-1.5 py-0.5 font-sans text-amber text-xs">
					{operationLabel[proposal.operation]}
				</span>
				<span className={`font-sans text-xs ${statusColor[proposal.status]}`}>
					{statusLabel[proposal.status]}
				</span>
			</div>

			{/* Instruction */}
			<p className="font-sans text-ink-muted text-sm leading-relaxed">
				{proposal.instruction}
			</p>

			{/* Preview for replace */}
			{preview && (
				<p className="mt-1.5 font-mono text-ink-dim text-xs italic">
					{preview}
				</p>
			)}

			{/* Pending hint — inline diff in editor handles accept/reject */}
			{isPending && (
				<p className="mt-1.5 font-sans text-ink-dim text-xs italic">
					在编辑器中查看修改建议
				</p>
			)}
		</div>
	);
}
