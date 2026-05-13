"use client";

import { Layers3, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Field, Label, Select, TextArea, TextInput } from "./ui/form";
import { PanelHeader } from "./ui/panel-header";

type OutlineForm = {
	title: string;
	description: string;
	status: "planned" | "writing" | "done";
	order: string;
	parentId: string;
	chapterId: string;
};

const emptyForm: OutlineForm = {
	title: "",
	description: "",
	status: "planned",
	order: "0",
	parentId: "",
	chapterId: "",
};

function nullable(value: string) {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function OutlinePanel({ projectId }: { projectId: string }) {
	const [outlines] = api.outline.listByProject.useSuspenseQuery({ projectId });
	const [chapters] = api.chapter.listByProject.useSuspenseQuery({ projectId });
	const utils = api.useUtils();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [form, setForm] = useState<OutlineForm>(emptyForm);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const selected = useMemo(
		() => outlines.find((outline) => outline.id === selectedId) ?? null,
		[outlines, selectedId],
	);

	const createOutline = api.outline.create.useMutation({
		onSuccess: async (outline) => {
			await utils.outline.listByProject.invalidate({ projectId });
			setSelectedId(outline.id);
		},
	});
	const updateOutline = api.outline.update.useMutation({
		onSuccess: async () => {
			await utils.outline.listByProject.invalidate({ projectId });
		},
	});
	const deleteOutline = api.outline.delete.useMutation({
		onSuccess: async () => {
			await utils.outline.listByProject.invalidate({ projectId });
			setSelectedId(null);
			setForm(emptyForm);
			setConfirmDeleteId(null);
		},
	});

	const startCreate = () => {
		const nextOrder =
			outlines.length > 0
				? Math.max(...outlines.map((outline) => outline.order)) + 1
				: 0;
		setSelectedId(null);
		setForm({ ...emptyForm, order: String(nextOrder) });
		setConfirmDeleteId(null);
	};

	const startEdit = (outline: (typeof outlines)[number]) => {
		setSelectedId(outline.id);
		setForm({
			title: outline.title,
			description: outline.description ?? "",
			status: outline.status as OutlineForm["status"],
			order: String(outline.order),
			parentId: outline.parentId ?? "",
			chapterId: outline.chapterId ?? "",
		});
		setConfirmDeleteId(null);
	};

	const save = () => {
		const title = form.title.trim();
		if (!title) return;
		const order = Number.parseInt(form.order, 10);
		const safeOrder = Number.isFinite(order) && order >= 0 ? order : 0;
		if (selected) {
			updateOutline.mutate({
				id: selected.id,
				title,
				description: nullable(form.description),
				order: safeOrder,
				parentId: nullable(form.parentId),
				chapterId: nullable(form.chapterId),
				status: form.status,
			});
			return;
		}
		createOutline.mutate({
			projectId,
			title,
			description: nullable(form.description),
			order: safeOrder,
			parentId: nullable(form.parentId),
			chapterId: nullable(form.chapterId),
			status: form.status,
		});
	};

	const pending =
		createOutline.isPending ||
		updateOutline.isPending ||
		deleteOutline.isPending;
	const error =
		createOutline.error?.message ??
		updateOutline.error?.message ??
		deleteOutline.error?.message;

	return (
		<section className="min-w-0 flex-1 overflow-y-auto bg-study-900 px-6 py-6 lg:px-8">
			<PanelHeader
				action={
					<Button onClick={startCreate} size="sm" type="button">
						<Plus aria-hidden="true" className="h-4 w-4" />
						新建节点
					</Button>
				}
				description="树状结构、章节关联与写作状态。"
				title="大纲"
				volume="Volume IX · Outline Index"
			/>

			<div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
				<div className="space-y-2">
					{outlines.length === 0 && (
						<Card className="p-4">
							<button
								className="w-full text-center text-ink-dim text-sm"
								onClick={startCreate}
								type="button"
							>
								创建第一个大纲节点
							</button>
						</Card>
					)}
					{outlines.map((outline) => (
						<button
							className={`w-full rounded border px-4 py-3 text-left transition-all duration-300 ${
								outline.id === selectedId
									? "border-amber/60 bg-amber/10"
									: "border-study-600 bg-study-800/70 hover:border-study-500 hover:bg-study-700/70"
							}`}
							key={outline.id}
							onClick={() => startEdit(outline)}
							type="button"
						>
							<p className="truncate text-ink text-sm">
								{outline.parentId ? "  " : ""}
								{outline.title}
							</p>
							<p className="mt-1 text-ink-dim text-xs">
								{outline.status} · {outline.order}
							</p>
						</button>
					))}
				</div>

				<Card className="p-5">
					<div className="mb-5 flex items-center justify-between gap-3">
						<div>
							<p className="font-label text-[10px] text-ink-muted uppercase tracking-[0.28em]">
								章节脉络
							</p>
							<h3 className="mt-1 font-display text-ink text-xl">
								{selected ? "编辑大纲" : "新建大纲"}
							</h3>
						</div>
						<Badge tone={selected ? "brass" : "muted"}>
							<Layers3 aria-hidden="true" className="h-3.5 w-3.5" />
						</Badge>
					</div>

					<div className="grid gap-4">
						<Field label={<Label htmlFor="outline-title">标题</Label>}>
							<TextInput
								disabled={pending}
								id="outline-title"
								onChange={(event) =>
									setForm((current) => ({
										...current,
										title: event.target.value,
									}))
								}
								placeholder="标题"
								value={form.title}
							/>
						</Field>
						<Field label={<Label htmlFor="outline-description">描述</Label>}>
							<TextArea
								disabled={pending}
								id="outline-description"
								onChange={(event) =>
									setForm((current) => ({
										...current,
										description: event.target.value,
									}))
								}
								placeholder="描述"
								value={form.description}
							/>
						</Field>
						<div className="grid gap-4 lg:grid-cols-2">
							<Field label={<Label htmlFor="outline-status">状态</Label>}>
								<Select
									disabled={pending}
									id="outline-status"
									onChange={(event) =>
										setForm((current) => ({
											...current,
											status: event.target.value as OutlineForm["status"],
										}))
									}
									value={form.status}
								>
									<option value="planned">planned</option>
									<option value="writing">writing</option>
									<option value="done">done</option>
								</Select>
							</Field>
							<Field label={<Label htmlFor="outline-order">顺序</Label>}>
								<TextInput
									disabled={pending}
									id="outline-order"
									min={0}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											order: event.target.value,
										}))
									}
									type="number"
									value={form.order}
								/>
							</Field>
						</div>
						<Field label={<Label htmlFor="outline-parent">父节点</Label>}>
							<Select
								disabled={pending}
								id="outline-parent"
								onChange={(event) =>
									setForm((current) => ({
										...current,
										parentId: event.target.value,
									}))
								}
								value={form.parentId}
							>
								<option value="">无父节点</option>
								{outlines
									.filter((outline) => outline.id !== selectedId)
									.map((outline) => (
										<option key={outline.id} value={outline.id}>
											{outline.title}
										</option>
									))}
							</Select>
						</Field>
						<Field label={<Label htmlFor="outline-chapter">章节</Label>}>
							<Select
								disabled={pending}
								id="outline-chapter"
								onChange={(event) =>
									setForm((current) => ({
										...current,
										chapterId: event.target.value,
									}))
								}
								value={form.chapterId}
							>
								<option value="">不关联章节</option>
								{chapters.map((chapter) => (
									<option key={chapter.id} value={chapter.id}>
										{chapter.order}. {chapter.title}
									</option>
								))}
							</Select>
						</Field>
					</div>

					{error && (
						<p className="mt-4 rounded border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-sm">
							{error}
						</p>
					)}

					<div className="mt-5 flex flex-wrap gap-2">
						<Button
							disabled={pending || !form.title.trim()}
							onClick={save}
							size="sm"
							type="button"
						>
							<Save aria-hidden="true" className="h-4 w-4" />
							{pending ? "保存中..." : "保存"}
						</Button>
						<Button
							disabled={pending}
							onClick={startCreate}
							size="sm"
							type="button"
							variant="quiet"
						>
							取消
						</Button>
						{selected && (
							<Button
								className="ml-auto"
								disabled={pending}
								onClick={() =>
									confirmDeleteId === selected.id
										? deleteOutline.mutate({ id: selected.id })
										: setConfirmDeleteId(selected.id)
								}
								size="sm"
								type="button"
								variant="danger"
							>
								<Trash2 aria-hidden="true" className="h-4 w-4" />
								{confirmDeleteId === selected.id ? "确认删除" : "删除"}
							</Button>
						)}
					</div>
				</Card>
			</div>
		</section>
	);
}
