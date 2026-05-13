"use client";

import { BookText, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { Field, Label, TextArea, TextInput } from "./ui/form";
import { ModalShell } from "./ui/modal";

interface CreateProjectDialogProps {
	onClose: () => void;
}

export function CreateProjectDialog({ onClose }: CreateProjectDialogProps) {
	const router = useRouter();
	const utils = api.useUtils();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [genre, setGenre] = useState("");

	const nameInputRef = useRef<HTMLInputElement>(null);
	const isSubmittable = name.trim().length > 0;

	const createProject = api.project.create.useMutation({
		onSuccess: (project) => {
			router.push(`/${project.id}`);
			void utils.project.invalidate();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!isSubmittable || createProject.isPending) return;
		createProject.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
			genre: genre.trim() || undefined,
		});
	};

	useEffect(() => {
		nameInputRef.current?.focus();
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !createProject.isPending) {
				onClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose, createProject.isPending]);

	return (
		<ModalShell
			ariaLabel="关闭新建项目窗口"
			description="每个故事都始于一个字。"
			footer={
				<div className="flex items-center justify-end gap-3">
					<Button
						disabled={createProject.isPending}
						onClick={onClose}
						size="sm"
						type="button"
						variant="quiet"
					>
						取消
					</Button>
					<Button
						disabled={!isSubmittable || createProject.isPending}
						form="create-project-form"
						size="sm"
						type="submit"
						variant="primary"
					>
						{createProject.isPending ? (
							<>
								<LoaderCircle
									aria-hidden="true"
									className="h-4 w-4 animate-spin"
								/>
								创建中
							</>
						) : (
							<>
								<BookText aria-hidden="true" className="h-4 w-4" />
								创建项目
							</>
						)}
					</Button>
				</div>
			}
			onClose={onClose}
			title="新建项目"
		>
			<form
				className="flex flex-col gap-5"
				id="create-project-form"
				onSubmit={handleSubmit}
			>
				<Field label={<Label htmlFor="project-name">名称</Label>}>
					<TextInput
						id="project-name"
						onChange={(e) => setName(e.target.value)}
						placeholder="未命名故事"
						ref={nameInputRef}
						type="text"
						value={name}
					/>
				</Field>

				<Field
					label={
						<Label htmlFor="project-description">
							简介 <span className="text-ink-dim normal-case">(可选)</span>
						</Label>
					}
				>
					<TextArea
						id="project-description"
						onChange={(e) => setDescription(e.target.value)}
						placeholder="简要描述你的故事..."
						rows={3}
						value={description}
					/>
				</Field>

				<Field
					label={
						<Label htmlFor="project-genre">
							类型 <span className="text-ink-dim normal-case">(可选)</span>
						</Label>
					}
				>
					<TextInput
						id="project-genre"
						onChange={(e) => setGenre(e.target.value)}
						placeholder="奇幻、悬疑、言情..."
						type="text"
						value={genre}
					/>
				</Field>

				{createProject.error && (
					<p className="rounded border border-rust/30 bg-rust/10 px-3 py-2 text-rust-light text-sm">
						{createProject.error.message ?? "出了点问题，请重试。"}
					</p>
				)}
			</form>
		</ModalShell>
	);
}
