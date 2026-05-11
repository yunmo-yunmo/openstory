"use client";

import { useMemo, useState } from "react";
import { tiptapToPlainText } from "~/server/services/tiptap-converter";
import { api } from "~/trpc/react";

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
		<section className="min-w-0 flex-1 overflow-y-auto bg-study-900 px-8 py-6">
			<div className="mx-auto flex max-w-5xl gap-6 max-lg:flex-col">
				<div className="w-80 shrink-0 max-lg:w-full">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-display text-2xl text-ink">世界设定</h2>
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
						{notes.length === 0 && (
							<button
								className="w-full rounded-sm border border-study-600 px-4 py-6 text-center font-sans text-ink-dim text-sm"
								onClick={startCreate}
								type="button"
							>
								创建第一条世界设定
							</button>
						)}
						{notes.map((note) => (
							<button
								className={`w-full rounded-sm border px-3 py-2 text-left transition-colors ${
									note.id === selectedId
										? "border-amber bg-amber-glow"
										: "border-study-600 bg-study-800 hover:border-study-500"
								}`}
								key={note.id}
								onClick={() => startEdit(note)}
								type="button"
							>
								<p className="truncate font-sans text-ink text-sm">
									{note.title}
								</p>
								<p className="mt-1 font-mono text-ink-dim text-xs">
									{note.category} · {note.order}
								</p>
							</button>
						))}
					</div>
				</div>
				<div className="min-w-0 flex-1 rounded-sm border border-study-600 bg-study-800 p-5">
					<h3 className="mb-4 font-sans font-semibold text-ink-muted text-sm">
						{selected ? "编辑世界设定" : "新建世界设定"}
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
							className="min-h-52 w-full rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
							disabled={pending}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									content: event.target.value,
								}))
							}
							placeholder="设定内容"
							value={form.content}
						/>
						<div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
							<select
								className="rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
								disabled={pending}
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
						<input
							className="w-full rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
							disabled={pending}
							onChange={(event) =>
								setForm((current) => ({ ...current, tags: event.target.value }))
							}
							placeholder="标签，用逗号分隔"
							value={form.tags}
						/>
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
										? deleteNote.mutate({ id: selected.id })
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
