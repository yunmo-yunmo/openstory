"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "~/trpc/react";
import { CreateProjectDialog } from "./create-project-dialog";
import { ModelServiceDialog } from "./model-service-dialog";

function timeAgo(date: Date | string): string {
	const now = Date.now();
	const then = new Date(date).getTime();
	const diffSec = Math.floor((now - then) / 1000);

	if (diffSec < 60) return "刚刚";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}分钟前`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}小时前`;
	const diffDay = Math.floor(diffHr / 24);
	if (diffDay < 30) return `${diffDay}天前`;
	const diffMonth = Math.floor(diffDay / 30);
	if (diffMonth < 12) return `${diffMonth}个月前`;
	const diffYear = Math.floor(diffMonth / 12);
	return `${diffYear}年前`;
}

export function ProjectDashboard() {
	const [projects] = api.project.list.useSuspenseQuery();
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showModelServices, setShowModelServices] = useState(false);

	if (projects.length === 0) {
		return (
			<>
				<div className="flex min-h-screen flex-col items-center justify-center px-6">
					<div className="flex flex-col items-center gap-8 text-center">
						{/* Quill icon */}
						<div className="flex h-20 w-20 items-center justify-center rounded-full border border-study-600 bg-study-800/50">
							<svg
								aria-hidden="true"
								className="h-10 w-10 text-amber/60"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</div>

						<div className="flex flex-col gap-3">
							<h2 className="font-display text-3xl text-ink">你的书房在等候</h2>
							<p className="max-w-sm text-ink-muted leading-relaxed">
								空白的书卷，安静的房间。创建你的第一个项目，开始编织故事。
							</p>
						</div>

						<div className="h-px w-32 bg-study-600" />

						<button
							className="group inline-flex items-center gap-2 rounded-sm border border-amber/40 bg-amber/10 px-7 py-3 font-sans text-amber transition-all duration-300 hover:border-amber hover:bg-amber/20 hover:shadow-[0_0_20px_var(--color-amber-glow)]"
							onClick={() => setShowCreateDialog(true)}
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
							创建第一个项目
						</button>
					</div>
				</div>

				{showCreateDialog && (
					<CreateProjectDialog onClose={() => setShowCreateDialog(false)} />
				)}
			</>
		);
	}

	return (
		<>
			<div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
				{/* Header */}
				<header className="mb-12 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="font-display text-3xl text-ink">我的项目</h2>
						<p className="mt-1 text-ink-muted text-sm">
							{projects.length} {projects.length === 1 ? "个项目" : "个项目"}
						</p>
					</div>
					<div className="flex items-center gap-3">
						<button
							className="inline-flex items-center gap-2 rounded-sm border border-study-600 px-4 py-2.5 font-sans text-ink-muted text-sm transition-colors hover:border-study-500 hover:bg-study-700 hover:text-ink"
							onClick={() => setShowModelServices(true)}
							type="button"
						>
							<svg
								aria-hidden="true"
								className="h-4 w-4"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							模型服务
						</button>
						<button
							className="inline-flex items-center gap-2 rounded-sm border border-amber/40 bg-amber/10 px-5 py-2.5 font-sans text-amber text-sm transition-all duration-300 hover:border-amber hover:bg-amber/20 hover:shadow-[0_0_16px_var(--color-amber-glow)]"
							onClick={() => setShowCreateDialog(true)}
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
							新建项目
						</button>
					</div>
				</header>

				{/* Project grid */}
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{projects.map((project) => (
						<Link
							className="group block rounded-sm border border-study-600 bg-study-800 p-6 transition-all duration-300 hover:border-study-500 hover:bg-study-700 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
							href={`/${project.id}`}
							key={project.id}
						>
							<div className="flex flex-col gap-3">
								{/* Title */}
								<h3 className="font-display text-ink text-lg leading-snug transition-colors group-hover:text-amber-light">
									{project.title}
								</h3>

								{/* Genre tag */}
								{project.genre && (
									<div>
										<span className="inline-block rounded-sm border border-study-500 px-2 py-0.5 font-sans text-ink-muted text-xs">
											{project.genre}
										</span>
									</div>
								)}

								{/* Description */}
								{project.description && (
									<p className="line-clamp-2 text-ink-dim text-sm leading-relaxed">
										{project.description}
									</p>
								)}

								{/* Timestamp */}
								<p className="mt-auto pt-2 font-sans text-ink-dim text-xs">
									更新于 {timeAgo(project.updatedAt)}
								</p>
							</div>
						</Link>
					))}
				</div>
			</div>

			{showCreateDialog && (
				<CreateProjectDialog onClose={() => setShowCreateDialog(false)} />
			)}

			{showModelServices && (
				<ModelServiceDialog onClose={() => setShowModelServices(false)} />
			)}
		</>
	);
}
