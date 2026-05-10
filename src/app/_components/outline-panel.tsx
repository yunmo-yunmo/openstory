"use client";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";

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
		<section className="min-w-0 flex-1 overflow-y-auto bg-study-900 px-8 py-6">
			<div className="mx-auto flex max-w-5xl gap-6 max-lg:flex-col">
				<div className="w-80 shrink-0 max-lg:w-full">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-display text-2xl text-ink">大纲</h2>
						<button
							className="rounded-sm bg-amber/20 px-3 py-1.5 font-sans text-amber text-sm disabled:opacity-40"
							disabled={pending}
							onClick={startCreate}
							type="button"
						>
							新建
						</button>
					</div>
					<div className="space-y-2">
						{outlines.length === 0 && (
							<button
								className="w-full rounded-sm border border-study-600 px-4 py-6 text-center font-sans text-ink-dim text-sm"
								onClick={startCreate}
								type="button"
							>
								创建第一个大纲节点
							</button>
						)}
						{outlines.map((outline) => (
							<button
								className={`w-full rounded-sm border px-3 py-2 text-left transition-colors ${
									outline.id === selectedId
										? "border-amber bg-amber-glow"
										: "border-study-600 bg-study-800 hover:border-study-500"
								}`}
								key={outline.id}
								onClick={() => startEdit(outline)}
								type="button"
							>
								<p className="truncate font-sans text-ink text-sm">
									{outline.parentId ? "  " : ""}
									{outline.title}
								</p>
								<p className="mt-1 font-mono text-ink-dim text-xs">
									{outline.status} · {outline.order}
								</p>
							</button>
						))}
					</div>
				</div>
				<div className="min-w-0 flex-1 rounded-sm border border-study-600 bg-study-800 p-5">
					<h3 className="mb-4 font-sans font-semibold text-ink-muted text-sm">
						{selected ? "编辑大纲" : "新建大纲"}
					</h3>
					<div className="grid gap-4">
						<input
							className="w-full rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
							disabled={pending}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									title: event.target.value,
								}))
							}
							placeholder="标题"
							value={form.title}
						/>
						<textarea
							className="min-h-24 w-full rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
							disabled={pending}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									description: event.target.value,
								}))
							}
							placeholder="描述"
							value={form.description}
						/>
						<div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
							<select
								className="rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
								disabled={pending}
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
							</select>
							<input
								className="rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
								disabled={pending}
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
						</div>
						<select
							className="rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
							disabled={pending}
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
						</select>
						<select
							className="rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
							disabled={pending}
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
						</select>
					</div>
					{error && <p className="mt-3 text-rust text-sm">{error}</p>}
					<div className="mt-5 flex flex-wrap gap-2">
						<button
							className="rounded-sm bg-amber/20 px-4 py-2 font-sans text-amber text-sm disabled:opacity-40"
							disabled={pending || !form.title.trim()}
							onClick={save}
							type="button"
						>
							{pending ? "保存中..." : "保存"}
						</button>
						<button
							className="rounded-sm px-4 py-2 font-sans text-ink-dim text-sm hover:text-ink-muted"
							disabled={pending}
							onClick={startCreate}
							type="button"
						>
							取消
						</button>
						{selected && (
							<button
								className="ml-auto rounded-sm px-4 py-2 font-sans text-rust text-sm hover:bg-rust/10 disabled:opacity-40"
								disabled={pending}
								onClick={() =>
									confirmDeleteId === selected.id
										? deleteOutline.mutate({ id: selected.id })
										: setConfirmDeleteId(selected.id)
								}
								type="button"
							>
								{confirmDeleteId === selected.id ? "确认删除" : "删除"}
							</button>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
