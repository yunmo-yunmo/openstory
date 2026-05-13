"use client";

import { Globe, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { tiptapToPlainText } from "~/server/services/tiptap-converter";
import { api } from "~/trpc/react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Field, Label, Select, TextArea, TextInput } from "./ui/form";
import { PanelHeader } from "./ui/panel-header";

type WorldNoteForm = {
	title: string;
	content: string;
	category: "general" | "location" | "history" | "magic" | "culture" | "other";
	tags: string;
	order: string;
};

const emptyForm: WorldNoteForm = {
	title: "",
	content: "",
	category: "general",
	tags: "",
	order: "0",
};

function parseTags(text: string) {
	return text
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function noteContentToText(content: string) {
	return tiptapToPlainText(content);
}

function noteTagsToText(tags: string | null) {
	if (!tags) return "";
	try {
		const parsed: unknown = JSON.parse(tags);
		if (!Array.isArray(parsed)) return "";
		return parsed
			.filter((tag): tag is string => typeof tag === "string")
			.join(", ");
	} catch {
		return "";
	}
}

export function WorldNotesPanel({ projectId }: { projectId: string }) {
	const [notes] = api.worldNote.listByProject.useSuspenseQuery({ projectId });
	const utils = api.useUtils();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [form, setForm] = useState<WorldNoteForm>(emptyForm);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const selected = useMemo(
		() => notes.find((note) => note.id === selectedId) ?? null,
		[notes, selectedId],
	);

	const createNote = api.worldNote.create.useMutation({
		onSuccess: async (note) => {
			await utils.worldNote.listByProject.invalidate({ projectId });
			setSelectedId(note.id);
		},
	});
	const updateNote = api.worldNote.update.useMutation({
		onSuccess: async () => {
			await utils.worldNote.listByProject.invalidate({ projectId });
		},
	});
	const deleteNote = api.worldNote.delete.useMutation({
		onSuccess: async () => {
			await utils.worldNote.listByProject.invalidate({ projectId });
			setSelectedId(null);
			setForm(emptyForm);
			setConfirmDeleteId(null);
		},
	});

	const startCreate = () => {
		const nextOrder =
			notes.length > 0 ? Math.max(...notes.map((note) => note.order)) + 1 : 0;
		setSelectedId(null);
		setForm({ ...emptyForm, order: String(nextOrder) });
		setConfirmDeleteId(null);
	};

	const startEdit = (note: (typeof notes)[number]) => {
		setSelectedId(note.id);
		setForm({
			title: note.title,
			content: noteContentToText(note.content),
			category: note.category as WorldNoteForm["category"],
			tags: noteTagsToText(note.tags),
			order: String(note.order),
		});
		setConfirmDeleteId(null);
	};

	const save = () => {
		const title = form.title.trim();
		if (!title) return;
		const order = Number.parseInt(form.order, 10);
		const safeOrder = Number.isFinite(order) && order >= 0 ? order : 0;
		if (selected) {
			updateNote.mutate({
				id: selected.id,
				title,
				content: form.content,
				category: form.category,
				tags: parseTags(form.tags),
				order: safeOrder,
			});
			return;
		}
		createNote.mutate({
			projectId,
			title,
			content: form.content,
			category: form.category,
			tags: parseTags(form.tags),
			order: safeOrder,
		});
	};

	const pending =
		createNote.isPending || updateNote.isPending || deleteNote.isPending;
	const error =
		createNote.error?.message ??
		updateNote.error?.message ??
		deleteNote.error?.message;

	return (
		<section className="min-w-0 flex-1 overflow-y-auto bg-study-900 px-6 py-6 lg:px-8">
			<PanelHeader
				description="世界观、地名、历史与风俗的索引。"
				title="世界设定"
				volume="Volume X · World Notes"
				action={
					<Button onClick={startCreate} size="sm" type="button">
						<Plus aria-hidden="true" className="h-4 w-4" />
						新建设定
					</Button>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
				<div className="space-y-2">
					{notes.length === 0 && (
						<Card className="p-4">
							<button className="w-full text-center text-ink-dim text-sm" onClick={startCreate} type="button">
								创建第一条世界设定
							</button>
						</Card>
					)}
					{notes.map((note) => (
						<button
							className={`w-full rounded border px-4 py-3 text-left transition-all duration-300 ${
								note.id === selectedId
									? "border-amber/60 bg-amber/10"
									: "border-study-600 bg-study-800/70 hover:border-study-500 hover:bg-study-700/70"
							}`}
							key={note.id}
							onClick={() => startEdit(note)}
							type="button"
						>
							<p className="truncate text-sm text-ink">{note.title}</p>
							<p className="mt-1 text-xs text-ink-dim">
								{note.category} · {note.order}
							</p>
						</button>
					))}
				</div>

				<Card className="p-5">
					<div className="mb-5 flex items-center justify-between gap-3">
						<div>
							<p className="font-label text-[10px] uppercase tracking-[0.28em] text-ink-muted">
								资料卷册
							</p>
							<h3 className="mt-1 font-display text-xl text-ink">
								{selected ? "编辑世界设定" : "新建世界设定"}
							</h3>
						</div>
						<Badge tone={selected ? "brass" : "muted"}>
							<Globe aria-hidden="true" className="h-3.5 w-3.5" />
						</Badge>
					</div>

					<div className="grid gap-4">
						<Field label={<Label htmlFor="world-title">标题</Label>}>
							<TextInput
								disabled={pending}
								id="world-title"
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
						<Field label={<Label htmlFor="world-content">设定内容</Label>}>
							<TextArea
								className="min-h-64"
								disabled={pending}
								id="world-content"
								onChange={(event) =>
									setForm((current) => ({
										...current,
										content: event.target.value,
									}))
								}
								placeholder="设定内容"
								value={form.content}
							/>
						</Field>
						<div className="grid gap-4 lg:grid-cols-2">
							<Field label={<Label htmlFor="world-category">分类</Label>}>
								<Select
									disabled={pending}
									id="world-category"
									onChange={(event) =>
										setForm((current) => ({
											...current,
											category: event.target.value as WorldNoteForm["category"],
										}))
									}
									value={form.category}
								>
									<option value="general">general</option>
									<option value="location">location</option>
									<option value="history">history</option>
									<option value="magic">magic</option>
									<option value="culture">culture</option>
									<option value="other">other</option>
								</Select>
							</Field>
							<Field label={<Label htmlFor="world-order">顺序</Label>}>
								<TextInput
									disabled={pending}
									id="world-order"
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
						<Field label={<Label htmlFor="world-tags">标签</Label>}>
							<TextInput
								disabled={pending}
								id="world-tags"
								onChange={(event) =>
									setForm((current) => ({ ...current, tags: event.target.value }))
								}
								placeholder="标签，用逗号分隔"
								value={form.tags}
							/>
						</Field>
					</div>

					{error && <p className="mt-4 rounded border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-sm">{error}</p>}

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
						<Button disabled={pending} onClick={startCreate} size="sm" type="button" variant="quiet">
							取消
						</Button>
						{selected && (
							<Button
								className="ml-auto"
								disabled={pending}
								onClick={() =>
									confirmDeleteId === selected.id
										? deleteNote.mutate({ id: selected.id })
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
