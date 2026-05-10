"use client";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";

type CharacterForm = {
	name: string;
	description: string;
	traits: string;
	relationships: string;
	notes: string;
};

const emptyForm: CharacterForm = {
	name: "",
	description: "",
	traits: "",
	relationships: "",
	notes: "",
};

function nullable(value: string) {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function CharactersPanel({ projectId }: { projectId: string }) {
	const [characters] = api.character.listByProject.useSuspenseQuery({
		projectId,
	});
	const utils = api.useUtils();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [form, setForm] = useState<CharacterForm>(emptyForm);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const selected = useMemo(
		() => characters.find((character) => character.id === selectedId) ?? null,
		[characters, selectedId],
	);

	const createCharacter = api.character.create.useMutation({
		onSuccess: async (character) => {
			await utils.character.listByProject.invalidate({ projectId });
			setSelectedId(character.id);
		},
	});
	const updateCharacter = api.character.update.useMutation({
		onSuccess: async () => {
			await utils.character.listByProject.invalidate({ projectId });
		},
	});
	const deleteCharacter = api.character.delete.useMutation({
		onSuccess: async () => {
			await utils.character.listByProject.invalidate({ projectId });
			setSelectedId(null);
			setForm(emptyForm);
			setConfirmDeleteId(null);
		},
	});

	const startCreate = () => {
		setSelectedId(null);
		setForm(emptyForm);
		setConfirmDeleteId(null);
	};

	const startEdit = (character: (typeof characters)[number]) => {
		setSelectedId(character.id);
		setForm({
			name: character.name,
			description: character.description ?? "",
			traits: character.traits ?? "",
			relationships: character.relationships ?? "",
			notes: character.notes ?? "",
		});
		setConfirmDeleteId(null);
	};

	const save = () => {
		const name = form.name.trim();
		if (!name) return;
		if (selected) {
			updateCharacter.mutate({
				id: selected.id,
				name,
				description: nullable(form.description),
				traits: nullable(form.traits),
				relationships: nullable(form.relationships),
				notes: nullable(form.notes),
			});
			return;
		}
		createCharacter.mutate({
			projectId,
			name,
			description: nullable(form.description) ?? undefined,
			traits: nullable(form.traits) ?? undefined,
			relationships: nullable(form.relationships) ?? undefined,
			notes: nullable(form.notes) ?? undefined,
		});
	};

	const pending =
		createCharacter.isPending ||
		updateCharacter.isPending ||
		deleteCharacter.isPending;
	const error =
		createCharacter.error?.message ??
		updateCharacter.error?.message ??
		deleteCharacter.error?.message;

	return (
		<section className="min-w-0 flex-1 overflow-y-auto bg-study-900 px-8 py-6">
			<div className="mx-auto flex max-w-5xl gap-6 max-lg:flex-col">
				<div className="w-72 shrink-0 max-lg:w-full">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-display text-2xl text-ink">角色</h2>
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
						{characters.length === 0 && (
							<button
								className="w-full rounded-sm border border-study-600 px-4 py-6 text-center font-sans text-ink-dim text-sm"
								onClick={startCreate}
								type="button"
							>
								创建第一个角色
							</button>
						)}
						{characters.map((character) => (
							<button
								className={`w-full rounded-sm border px-3 py-2 text-left transition-colors ${
									character.id === selectedId
										? "border-amber bg-amber-glow"
										: "border-study-600 bg-study-800 hover:border-study-500"
								}`}
								key={character.id}
								onClick={() => startEdit(character)}
								type="button"
							>
								<p className="truncate font-sans text-ink text-sm">
									{character.name}
								</p>
								{character.description && (
									<p className="mt-1 line-clamp-2 font-sans text-ink-dim text-xs">
										{character.description}
									</p>
								)}
							</button>
						))}
					</div>
				</div>
				<div className="min-w-0 flex-1 rounded-sm border border-study-600 bg-study-800 p-5">
					<h3 className="mb-4 font-sans font-semibold text-ink-muted text-sm">
						{selected ? "编辑角色" : "新建角色"}
					</h3>
					<div className="space-y-4">
						<input
							className="w-full rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
							disabled={pending}
							onChange={(event) =>
								setForm((current) => ({ ...current, name: event.target.value }))
							}
							placeholder="角色名"
							value={form.name}
						/>
						{(["description", "traits", "relationships", "notes"] as const).map(
							(field) => (
								<textarea
									className="min-h-20 w-full rounded-sm border border-study-600 bg-study-700 px-3 py-2 font-sans text-ink text-sm outline-none focus:border-amber/60"
									disabled={pending}
									key={field}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											[field]: event.target.value,
										}))
									}
									placeholder={
										{
											description: "简介",
											traits: "特质",
											relationships: "关系",
											notes: "备注",
										}[field]
									}
									value={form[field]}
								/>
							),
						)}
					</div>
					{error && <p className="mt-3 text-rust text-sm">{error}</p>}
					<div className="mt-5 flex flex-wrap gap-2">
						<button
							className="rounded-sm bg-amber/20 px-4 py-2 font-sans text-amber text-sm disabled:opacity-40"
							disabled={pending || !form.name.trim()}
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
										? deleteCharacter.mutate({ id: selected.id })
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
