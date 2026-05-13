"use client";

import {
	CheckCircle2,
	LoaderCircle,
	Plus,
	RotateCcw,
	Shield,
	Trash2,
	Wand2,
} from "lucide-react";
import { useState } from "react";
import { api } from "~/trpc/react";
import { getConfigCardMutationState } from "./model-service-dialog-state";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { EmptyState } from "./ui/empty-state";
import { Field, Label, Select, TextInput } from "./ui/form";
import { ModalShell } from "./ui/modal";

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

	const [configs] = api.llmConfig.list.useSuspenseQuery();

	const [name, setName] = useState("");
	const [providerType, setProviderType] = useState<ProviderType>("anthropic");
	const [apiKey, setApiKey] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [model, setModel] = useState("");

	const invalidateList = async () => {
		await utils.llmConfig.list.invalidate();
		await utils.llmConfig.status.invalidate();
	};

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
		<ModalShell
			ariaLabel="关闭模型服务窗口"
			className="max-w-4xl"
			description="配置 AI 提供商并管理写作助手的 API 密钥。"
			disableEscapeClose={createMutation.isPending}
			disableOverlayClose={createMutation.isPending}
			footer={
				<div className="flex items-center justify-end">
					<Button
						disabled={createMutation.isPending}
						onClick={onClose}
						size="sm"
						type="button"
						variant="quiet"
					>
						关闭
					</Button>
				</div>
			}
			onClose={onClose}
			title="模型服务"
		>
			<div className="flex flex-col gap-5">
				{configs.length === 0 && !showCreateForm && (
					<EmptyState
						action={
							<Button onClick={() => setShowCreateForm(true)} size="sm">
								<Plus aria-hidden="true" className="h-4 w-4" />
								添加模型服务
							</Button>
						}
						description="添加一个提供商即可开始与 AI 助手对话。"
						icon={
							<Shield
								aria-hidden="true"
								className="h-9 w-9"
								strokeWidth={1.5}
							/>
						}
						title="暂无模型服务配置"
						volume="Volume III · Provider Registry"
					/>
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

				{showCreateForm && (
					<Card className="p-5">
						<form className="flex flex-col gap-4" onSubmit={handleCreate}>
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="mb-1 font-label text-[10px] text-amber uppercase tracking-[0.28em]">
										Volume IV
									</p>
									<h3 className="font-display text-ink text-xl">
										新建模型服务
									</h3>
								</div>
								<Button
									disabled={createMutation.isPending}
									onClick={() => setShowCreateForm(false)}
									size="sm"
									type="button"
									variant="quiet"
								>
									取消
								</Button>
							</div>

							<Field label={<Label htmlFor="config-name">名称</Label>}>
								<TextInput
									id="config-name"
									onChange={(e) => setName(e.target.value)}
									placeholder="My Anthropic Key"
									type="text"
									value={name}
								/>
							</Field>

							<Field label={<Label htmlFor="config-provider">提供商</Label>}>
								<Select
									id="config-provider"
									onChange={(e) =>
										setProviderType(e.target.value as ProviderType)
									}
									value={providerType}
								>
									<option value="anthropic">Anthropic</option>
									<option value="openai-compatible">OpenAI 兼容</option>
								</Select>
							</Field>

							<Field label={<Label htmlFor="config-apikey">API 密钥</Label>}>
								<TextInput
									id="config-apikey"
									onChange={(e) => setApiKey(e.target.value)}
									placeholder="sk-..."
									type="password"
									value={apiKey}
								/>
							</Field>

							{providerType === "openai-compatible" && (
								<Field
									label={
										<Label htmlFor="config-baseurl">
											接口地址{" "}
											<span className="text-ink-dim normal-case">(可选)</span>
										</Label>
									}
								>
									<TextInput
										id="config-baseurl"
										onChange={(e) => setBaseUrl(e.target.value)}
										placeholder="https://api.openai.com/v1"
										type="url"
										value={baseUrl}
									/>
								</Field>
							)}

							<Field
								label={
									<Label htmlFor="config-model">
										默认模型{" "}
										<span className="text-ink-dim normal-case">(可选)</span>
									</Label>
								}
							>
								<TextInput
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
							</Field>

							{createMutation.error && (
								<p className="rounded border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-sm">
									{createMutation.error.message ?? "创建配置失败"}
								</p>
							)}

							<div className="flex items-center justify-end gap-3 pt-2">
								<Button
									disabled={createMutation.isPending}
									onClick={() => setShowCreateForm(false)}
									size="sm"
									type="button"
									variant="quiet"
								>
									取消
								</Button>
								<Button
									disabled={!isSubmittable || createMutation.isPending}
									size="sm"
									type="submit"
								>
									{createMutation.isPending ? (
										<>
											<LoaderCircle
												aria-hidden="true"
												className="h-4 w-4 animate-spin"
											/>
											保存中
										</>
									) : (
										<>
											<Wand2 aria-hidden="true" className="h-4 w-4" />
											创建
										</>
									)}
								</Button>
							</div>
						</form>
					</Card>
				)}

				{!showCreateForm && (
					<div className="flex justify-start">
						<Button
							onClick={() => setShowCreateForm(true)}
							size="sm"
							type="button"
							variant="quiet"
						>
							<Plus aria-hidden="true" className="h-4 w-4" />
							添加模型服务
						</Button>
					</div>
				)}
			</div>
		</ModalShell>
	);
}

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
	const {
		isActivatingCard,
		isDeletingCard,
		isFetchingModelsForCard,
		isLoading,
		isTestingConnectionForCard,
	} = getConfigCardMutationState({
		configId: config.id,
		deleteMutation,
		fetchModelsMutation,
		setActiveMutation,
		testConnectionMutation,
	});

	return (
		<Card
			className={config.isActive ? "border-amber/50 bg-amber/5 p-4" : "p-4"}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h4 className="truncate font-display text-ink text-lg">
							{config.name}
						</h4>
						{config.isActive && <Badge tone="brass">使用中</Badge>}
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<Badge tone="muted">
							{PROVIDER_LABELS[config.providerType as ProviderType] ??
								config.providerType}
						</Badge>
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

			{config.availableModels.length > 0 && (
				<div className="mt-4 border-study-600/60 border-t pt-3">
					<p className="text-ink-dim text-xs">
						{config.availableModels.length} 个模型可用
						{config.modelsUpdatedAt && (
							<span className="ml-1">
								(获取于 {new Date(config.modelsUpdatedAt).toLocaleDateString()})
							</span>
						)}
					</p>
					<div className="mt-2 flex max-h-16 flex-wrap gap-1 overflow-y-auto">
						{config.availableModels.slice(0, 8).map((m) => (
							<span
								className="rounded border border-study-600 bg-study-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim"
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

			<div className="mt-4 flex flex-wrap items-center gap-2 border-study-600/60 border-t pt-3">
				{!config.isActive && (
					<Button
						disabled={isLoading}
						onClick={() => setActiveMutation.mutate({ id: config.id })}
						size="sm"
						type="button"
						variant="secondary"
					>
						{isActivatingCard ? "激活中" : "激活"}
					</Button>
				)}
				<Button
					disabled={isLoading}
					onClick={() => fetchModelsMutation.mutate({ id: config.id })}
					size="sm"
					type="button"
					variant="quiet"
				>
					<RotateCcw aria-hidden="true" className="h-4 w-4" />
					{isFetchingModelsForCard ? "获取中" : "获取模型"}
				</Button>
				<Button
					disabled={isLoading}
					onClick={() =>
						testConnectionMutation.mutate({
							id: config.id,
							model: config.model ?? undefined,
						})
					}
					size="sm"
					type="button"
					variant="quiet"
				>
					<CheckCircle2 aria-hidden="true" className="h-4 w-4" />
					{isTestingConnectionForCard ? "测试中" : "测试连接"}
				</Button>

				{!confirmDelete ? (
					<Button
						className="ml-auto"
						disabled={isLoading}
						onClick={() => setConfirmDelete(true)}
						size="sm"
						type="button"
						variant="danger"
					>
						<Trash2 aria-hidden="true" className="h-4 w-4" />
						删除
					</Button>
				) : (
					<div className="ml-auto flex items-center gap-2">
						<span className="text-rust text-xs">确认删除此服务？</span>
						<Button
							disabled={isLoading}
							onClick={() => {
								deleteMutation.mutate({ id: config.id });
							}}
							size="sm"
							type="button"
							variant="danger"
						>
							{isDeletingCard ? "删除中" : "确认"}
						</Button>
						<Button
							disabled={isLoading}
							onClick={() => setConfirmDelete(false)}
							size="sm"
							type="button"
							variant="quiet"
						>
							取消
						</Button>
					</div>
				)}
			</div>

			{fetchModelsMutation.error &&
				fetchModelsMutation.variables?.id === config.id && (
					<p className="mt-3 rounded border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-xs">
						{fetchModelsMutation.error.message ?? "获取模型失败"}
					</p>
				)}
			{testConnectionMutation.error &&
				testConnectionMutation.variables?.id === config.id && (
					<p className="mt-3 rounded border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-xs">
						{testConnectionMutation.error.message ?? "连接测试失败"}
					</p>
				)}
			{testConnectionMutation.isSuccess &&
				testConnectionMutation.variables?.id === config.id && (
					<p className="mt-3 rounded border border-sage/30 bg-sage/10 px-3 py-2 text-sage-light text-xs">
						连接成功
					</p>
				)}
		</Card>
	);
}
