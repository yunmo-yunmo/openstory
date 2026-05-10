"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

interface ModelServiceDialogProps {
	onClose: () => void;
}

type ProviderType = "anthropic" | "openai-compatible";

const PROVIDER_LABELS: Record<ProviderType, string> = {
	anthropic: "Anthropic",
	"openai-compatible": "OpenAI 兼容",
};

export function ModelServiceDialog({ onClose }: ModelServiceDialogProps) {
	const utils = api.useUtils();
	const [showCreateForm, setShowCreateForm] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);

	const [configs] = api.llmConfig.list.useSuspenseQuery();

	// Create form state
	const [name, setName] = useState("");
	const [providerType, setProviderType] = useState<ProviderType>("anthropic");
	const [apiKey, setApiKey] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [model, setModel] = useState("");

	// Close on Escape
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	const handleOverlayClick = () => onClose();

	const invalidateList = async () => {
		await utils.llmConfig.list.invalidate();
		await utils.llmConfig.status.invalidate();
	};

	// Mutations
	const createMutation = api.llmConfig.create.useMutation({
		onSuccess: async () => {
			setName("");
			setApiKey("");
			setBaseUrl("");
			setModel("");
			setShowCreateForm(false);
			await invalidateList();
		},
	});

	const deleteMutation = api.llmConfig.delete.useMutation({
		onSuccess: () => invalidateList(),
	});

	const setActiveMutation = api.llmConfig.setActive.useMutation({
		onSuccess: () => invalidateList(),
	});

	const fetchModelsMutation = api.llmConfig.fetchModels.useMutation({
		onSuccess: () => invalidateList(),
	});

	const testConnectionMutation = api.llmConfig.testConnection.useMutation({
		onSuccess: () => invalidateList(),
	});

	const isSubmittable = name.trim().length > 0 && apiKey.trim().length > 0;

	const handleCreate = (e: React.FormEvent) => {
		e.preventDefault();
		if (!isSubmittable || createMutation.isPending) return;
		createMutation.mutate({
			name: name.trim(),
			providerType,
			apiKey: apiKey.trim(),
			baseUrl:
				providerType === "openai-compatible" && baseUrl.trim()
					? baseUrl.trim()
					: undefined,
			model: model.trim() || undefined,
			isActive: configs.length === 0,
		});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
			<button
				aria-label="关闭模型服务窗口"
				className="absolute inset-0 cursor-default"
				onClick={handleOverlayClick}
				type="button"
			/>
			<div
				className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-sm border border-study-600 bg-study-800 shadow-[0_8px_48px_rgba(0,0,0,0.5)]"
				ref={panelRef}
			>
				{/* Header */}
				<div className="shrink-0 border-study-600 border-b px-6 py-5">
					<h2 className="font-display text-ink text-xl">模型服务</h2>
					<p className="mt-1 text-ink-muted text-sm">
						配置 AI 提供商并管理写作助手的 API 密钥。
					</p>
				</div>

				{/* Scrollable body */}
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
					{/* Config list */}
					{configs.length === 0 && !showCreateForm && (
						<div className="flex flex-col items-center gap-4 py-8 text-center">
							<svg
								aria-hidden="true"
								className="h-12 w-12 text-ink-dim"
								fill="none"
								stroke="currentColor"
								strokeWidth={1}
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							<div>
								<p className="font-sans text-ink-muted text-sm">
									暂无模型服务配置
								</p>
								<p className="mt-1 font-sans text-ink-dim text-xs">
									添加一个提供商即可开始与 AI 助手对话
								</p>
							</div>
						</div>
					)}

					{configs.map((config) => (
						<ConfigCard
							config={config}
							deleteMutation={deleteMutation}
							fetchModelsMutation={fetchModelsMutation}
							key={config.id}
							setActiveMutation={setActiveMutation}
							testConnectionMutation={testConnectionMutation}
						/>
					))}

					{/* Create form */}
					{showCreateForm && (
						<form
							className="mt-4 flex flex-col gap-4 rounded-sm border border-study-600 bg-study-900 p-5"
							onSubmit={handleCreate}
						>
							<h3 className="font-display text-ink text-sm">新建模型服务</h3>

							{/* Name */}
							<div className="flex flex-col gap-1.5">
								<label
									className="font-sans text-ink-muted text-xs uppercase tracking-wider"
									htmlFor="config-name"
								>
									名称
								</label>
								<input
									className="rounded-sm border border-study-600 bg-study-800 px-3 py-2 font-sans text-ink text-sm placeholder:text-ink-dim/60 focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
									id="config-name"
									onChange={(e) => setName(e.target.value)}
									placeholder="My Anthropic Key"
									type="text"
									value={name}
								/>
							</div>

							{/* Provider type */}
							<div className="flex flex-col gap-1.5">
								<label
									className="font-sans text-ink-muted text-xs uppercase tracking-wider"
									htmlFor="config-provider"
								>
									提供商
								</label>
								<select
									className="rounded-sm border border-study-600 bg-study-800 px-3 py-2 font-sans text-ink text-sm focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
									id="config-provider"
									onChange={(e) =>
										setProviderType(e.target.value as ProviderType)
									}
									value={providerType}
								>
									<option value="anthropic">Anthropic</option>
									<option value="openai-compatible">OpenAI 兼容</option>
								</select>
							</div>

							{/* API Key */}
							<div className="flex flex-col gap-1.5">
								<label
									className="font-sans text-ink-muted text-xs uppercase tracking-wider"
									htmlFor="config-apikey"
								>
									API 密钥
								</label>
								<input
									className="rounded-sm border border-study-600 bg-study-800 px-3 py-2 font-sans text-ink text-sm placeholder:text-ink-dim/60 focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
									id="config-apikey"
									onChange={(e) => setApiKey(e.target.value)}
									placeholder="sk-..."
									type="password"
									value={apiKey}
								/>
							</div>

							{/* Base URL (only for openai-compatible) */}
							{providerType === "openai-compatible" && (
								<div className="flex flex-col gap-1.5">
									<label
										className="font-sans text-ink-muted text-xs uppercase tracking-wider"
										htmlFor="config-baseurl"
									>
										接口地址
										<span className="ml-1 text-ink-dim normal-case">
											(可选)
										</span>
									</label>
									<input
										className="rounded-sm border border-study-600 bg-study-800 px-3 py-2 font-sans text-ink text-sm placeholder:text-ink-dim/60 focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
										id="config-baseurl"
										onChange={(e) => setBaseUrl(e.target.value)}
										placeholder="https://api.openai.com/v1"
										type="url"
										value={baseUrl}
									/>
								</div>
							)}

							{/* Model */}
							<div className="flex flex-col gap-1.5">
								<label
									className="font-sans text-ink-muted text-xs uppercase tracking-wider"
									htmlFor="config-model"
								>
									默认模型
									<span className="ml-1 text-ink-dim normal-case">(可选)</span>
								</label>
								<input
									className="rounded-sm border border-study-600 bg-study-800 px-3 py-2 font-sans text-ink text-sm placeholder:text-ink-dim/60 focus:border-amber/60 focus:outline-none focus:ring-1 focus:ring-amber/40"
									id="config-model"
									onChange={(e) => setModel(e.target.value)}
									placeholder={
										providerType === "anthropic"
											? "claude-sonnet-4-20250514"
											: "gpt-4o"
									}
									type="text"
									value={model}
								/>
							</div>

							{/* Create form errors */}
							{createMutation.error && (
								<p className="rounded-sm border border-rust/30 bg-rust/10 px-3 py-2 text-rust text-xs">
									{createMutation.error.message ?? "创建配置失败"}
								</p>
							)}

							{/* Form actions */}
							<div className="flex items-center justify-end gap-3 border-study-600 border-t pt-4">
								<button
									className="rounded-sm border border-study-600 px-4 py-2 font-sans text-ink-muted text-sm transition-colors hover:border-study-500 hover:bg-study-700 hover:text-ink"
									disabled={createMutation.isPending}
									onClick={() => setShowCreateForm(false)}
									type="button"
								>
									取消
								</button>
								<button
									className="rounded-sm border border-amber/50 bg-amber/10 px-6 py-2 font-sans text-amber text-sm transition-all duration-300 hover:border-amber hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-40"
									disabled={!isSubmittable || createMutation.isPending}
									type="submit"
								>
									{createMutation.isPending ? "保存中..." : "创建"}
								</button>
							</div>
						</form>
					)}

					{/* Add new button */}
					{!showCreateForm && (
						<button
							className="mt-4 inline-flex items-center gap-2 rounded-sm border border-study-600 px-4 py-2 font-sans text-ink-muted text-sm transition-colors hover:border-study-500 hover:bg-study-700 hover:text-ink"
							onClick={() => setShowCreateForm(true)}
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
							添加模型服务
						</button>
					)}
				</div>

				{/* Footer */}
				<div className="shrink-0 border-study-600 border-t px-6 py-4">
					<div className="flex items-center justify-end">
						<button
							className="rounded-sm border border-study-600 px-5 py-2 font-sans text-ink-muted text-sm transition-colors hover:border-study-500 hover:bg-study-700 hover:text-ink"
							onClick={onClose}
							type="button"
						>
							关闭
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Config card                                                         */
/* ------------------------------------------------------------------ */

interface ConfigCardProps {
	config: {
		id: string;
		name: string;
		providerType: string;
		baseUrl: string | null;
		model: string | null;
		availableModels: string[];
		modelsUpdatedAt: Date | null;
		isActive: boolean;
		hasApiKey: boolean;
	};
	deleteMutation: ReturnType<typeof api.llmConfig.delete.useMutation>;
	fetchModelsMutation: ReturnType<typeof api.llmConfig.fetchModels.useMutation>;
	setActiveMutation: ReturnType<typeof api.llmConfig.setActive.useMutation>;
	testConnectionMutation: ReturnType<
		typeof api.llmConfig.testConnection.useMutation
	>;
}

function ConfigCard({
	config,
	deleteMutation,
	fetchModelsMutation,
	setActiveMutation,
	testConnectionMutation,
}: ConfigCardProps) {
	const [confirmDelete, setConfirmDelete] = useState(false);

	const isLoading =
		fetchModelsMutation.isPending ||
		testConnectionMutation.isPending ||
		setActiveMutation.isPending ||
		(deleteMutation.isPending && deleteMutation.variables?.id === config.id);

	return (
		<div
			className={`rounded-sm border p-4 ${
				config.isActive
					? "border-amber/40 bg-amber/5"
					: "border-study-600 bg-study-900"
			}`}
		>
			{/* Top row: name, provider badge, active indicator */}
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h4 className="truncate font-display text-ink text-sm">
							{config.name}
						</h4>
						{config.isActive && (
							<span className="shrink-0 rounded-sm bg-amber/20 px-1.5 py-0.5 font-sans text-[10px] text-amber uppercase tracking-wider">
								使用中
							</span>
						)}
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-2">
						<span className="rounded-sm border border-study-500 px-1.5 py-0.5 font-sans text-[10px] text-ink-dim">
							{PROVIDER_LABELS[config.providerType as ProviderType] ??
								config.providerType}
						</span>
						{config.model && (
							<span className="font-mono text-ink-dim text-xs">
								{config.model}
							</span>
						)}
						{config.baseUrl && (
							<span className="max-w-[180px] truncate font-mono text-ink-dim text-xs">
								{config.baseUrl}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Available models */}
			{config.availableModels.length > 0 && (
				<div className="mt-3 border-study-600/50 border-t pt-2">
					<p className="font-sans text-ink-dim text-xs">
						{config.availableModels.length}个模型可用
						{config.modelsUpdatedAt && (
							<span className="ml-1">
								(获取于 {new Date(config.modelsUpdatedAt).toLocaleDateString()})
							</span>
						)}
					</p>
					<div className="mt-1 flex max-h-16 flex-wrap gap-1 overflow-y-auto">
						{config.availableModels.slice(0, 8).map((m) => (
							<span
								className="rounded-sm bg-study-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim"
								key={m}
							>
								{m}
							</span>
						))}
						{config.availableModels.length > 8 && (
							<span className="font-mono text-[10px] text-ink-dim">
								+{config.availableModels.length - 8} 更多
							</span>
						)}
					</div>
				</div>
			)}

			{/* Action buttons */}
			<div className="mt-3 flex flex-wrap items-center gap-2 border-study-600/50 border-t pt-3">
				{!config.isActive && (
					<button
						className="rounded-sm border border-amber/40 bg-amber/10 px-3 py-1.5 font-sans text-amber text-xs transition-colors hover:border-amber hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-40"
						disabled={setActiveMutation.isPending}
						onClick={() => setActiveMutation.mutate({ id: config.id })}
						type="button"
					>
						{setActiveMutation.isPending ? "激活中..." : "激活"}
					</button>
				)}

				<button
					className="rounded-sm border border-study-600 px-3 py-1.5 font-sans text-ink-muted text-xs transition-colors hover:border-study-500 hover:bg-study-700 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
					disabled={isLoading}
					onClick={() => fetchModelsMutation.mutate({ id: config.id })}
					type="button"
				>
					{fetchModelsMutation.isPending ? "获取中..." : "获取模型"}
				</button>

				<button
					className="rounded-sm border border-study-600 px-3 py-1.5 font-sans text-ink-muted text-xs transition-colors hover:border-study-500 hover:bg-study-700 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
					disabled={isLoading}
					onClick={() =>
						testConnectionMutation.mutate({
							id: config.id,
							model: config.model ?? undefined,
						})
					}
					type="button"
				>
					{testConnectionMutation.isPending ? "测试中..." : "测试连接"}
				</button>

				{!confirmDelete ? (
					<button
						className="ml-auto rounded-sm border border-study-600 px-3 py-1.5 font-sans text-ink-dim text-xs transition-colors hover:border-rust/40 hover:bg-rust/10 hover:text-rust disabled:cursor-not-allowed disabled:opacity-40"
						disabled={isLoading}
						onClick={() => setConfirmDelete(true)}
						type="button"
					>
						删除
					</button>
				) : (
					<div className="ml-auto flex items-center gap-2">
						<span className="font-sans text-rust text-xs">
							确认删除此服务？
						</span>
						<button
							className="rounded-sm border border-rust/40 bg-rust/10 px-3 py-1.5 font-sans text-rust text-xs transition-colors hover:bg-rust/20"
							onClick={() => {
								deleteMutation.mutate({ id: config.id });
								setConfirmDelete(false);
							}}
							type="button"
						>
							确认
						</button>
						<button
							className="rounded-sm border border-study-600 px-3 py-1.5 font-sans text-ink-muted text-xs transition-colors hover:bg-study-700"
							onClick={() => setConfirmDelete(false)}
							type="button"
						>
							取消
						</button>
					</div>
				)}
			</div>

			{/* Mutation feedback */}
			{fetchModelsMutation.error &&
				fetchModelsMutation.variables?.id === config.id && (
					<p className="mt-2 rounded-sm border border-rust/30 bg-rust/10 px-3 py-1.5 text-rust text-xs">
						{fetchModelsMutation.error.message ?? "获取模型失败"}
					</p>
				)}
			{testConnectionMutation.error &&
				testConnectionMutation.variables?.id === config.id && (
					<p className="mt-2 rounded-sm border border-rust/30 bg-rust/10 px-3 py-1.5 text-rust text-xs">
						{testConnectionMutation.error.message ?? "连接测试失败"}
					</p>
				)}
			{testConnectionMutation.isSuccess &&
				testConnectionMutation.variables?.id === config.id && (
					<p className="mt-2 rounded-sm border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-green-400 text-xs">
						连接成功
					</p>
				)}
		</div>
	);
}
