"use client";

import { BookUser, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Field, Label, TextArea, TextInput } from "./ui/form";
import { PanelHeader } from "./ui/panel-header";

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
		<section className="min-w-0 flex-1 overflow-y-auto bg-study-900 px-6 py-6 lg:px-8">
			<PanelHeader
				description="角色图谱与关系资料卡。"
				title="角色"
				volume="Volume VIII · Character Ledger"
				action={
					<Button onClick={startCreate} size="sm" type="button">
						<Plus aria-hidden="true" className="h-4 w-4" />
						新建角色
					</Button>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
				<div className="space-y-2">
					{characters.length === 0 && (
						<Card className="p-4">
							<button className="w-full text-center text-ink-dim text-sm" onClick={startCreate} type="button">
								创建第一个角色
							</button>
						</Card>
					)}
					{characters.map((character) => (
						<button
							className={`w-full rounded border px-4 py-3 text-left transition-all duration-300 ${
								character.id === selectedId
									? "border-amber/60 bg-amber/10"
									: "border-study-600 bg-study-800/70 hover:border-study-500 hover:bg-study-700/70"
							}`}
							key={character.id}
							onClick={() => startEdit(character)}
							type="button"
						>
							<p className="truncate text-sm text-ink">{character.name}</p>
							{character.description && (
								<p className="mt-1 line-clamp-2 text-xs text-ink-dim">
									{character.description}
								</p>
							)}
						</button>
					))}
				</div>

				<Card className="p-5">
					<div className="mb-5 flex items-center justify-between gap-3">
						<div>
							<p className="font-label text-[10px] uppercase tracking-[0.28em] text-ink-muted">
								当前卷册
							</p>
							<h3 className="mt-1 font-display text-xl text-ink">
								{selected ? "编辑角色" : "新建角色"}
							</h3>
						</div>
						<Badge tone={selected ? "brass" : "muted"}>
							<BookUser aria-hidden="true" className="h-3.5 w-3.5" />
						</Badge>
					</div>

					<div className="grid gap-4">
						<Field label={<Label htmlFor="character-name">角色名</Label>}>
							<TextInput
								disabled={pending}
								id="character-name"
								onChange={(event) =>
									setForm((current) => ({ ...current, name: event.target.value }))
								}
								placeholder="角色名"
								value={form.name}
							/>
						</Field>
						<Field label={<Label htmlFor="character-description">简介</Label>}>
							<TextArea
								disabled={pending}
								id="character-description"
								onChange={(event) =>
									setForm((current) => ({
										...current,
										description: event.target.value,
									}))
								}
								placeholder="简介"
								value={form.description}
							/>
						</Field>
						<div className="grid gap-4 lg:grid-cols-2">
							<Field label={<Label htmlFor="character-traits">特质</Label>}>
								<TextArea
									disabled={pending}
									id="character-traits"
									onChange={(event) =>
										setForm((current) => ({ ...current, traits: event.target.value }))
									}
									placeholder="特质"
									value={form.traits}
								/>
							</Field>
							<Field label={<Label htmlFor="character-relationships">关系</Label>}>
								<TextArea
									disabled={pending}
									id="character-relationships"
									onChange={(event) =>
										setForm((current) => ({
											...current,
											relationships: event.target.value,
										}))
									}
									placeholder="关系"
									value={form.relationships}
								/>
							</Field>
						</div>
						<Field label={<Label htmlFor="character-notes">备注</Label>}>
							<TextArea
								disabled={pending}
								id="character-notes"
								onChange={(event) =>
									setForm((current) => ({ ...current, notes: event.target.value }))
								}
								placeholder="备注"
								value={form.notes}
							/>
						</Field>
					</div>

					{error && <p className="mt-4 rounded border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-sm">{error}</p>}

					<div className="mt-5 flex flex-wrap gap-2">
						<Button
							disabled={pending || !form.name.trim()}
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
										? deleteCharacter.mutate({ id: selected.id })
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
