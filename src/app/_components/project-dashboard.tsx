"use client";

import Link from "next/link";
import { useState } from "react";
import { BookPlus, Settings2, Sparkles } from "lucide-react";
import { api } from "~/trpc/react";
import { CreateProjectDialog } from "./create-project-dialog";
import { ModelServiceDialog } from "./model-service-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { EmptyState } from "./ui/empty-state";
import { OrnateDivider, VolumeLabel } from "./ui/decorative";
import { PanelHeader } from "./ui/panel-header";

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
				<main className="flex min-h-screen items-center justify-center px-6 py-16">
					<section className="w-full max-w-4xl">
						<EmptyState
							action={
								<Button onClick={() => setShowCreateDialog(true)} size="lg">
									<BookPlus aria-hidden="true" className="h-4 w-4" />
									创建第一个项目
								</Button>
							}
							description="空白的书卷，安静的房间。创建你的第一个项目，开始编织故事。"
							icon={<Sparkles aria-hidden="true" className="h-9 w-9" strokeWidth={1.5} />}
							title="你的书房在等候"
							volume="Volume II · The Empty Library"
						/>
					</section>
				</main>

				{showCreateDialog && (
					<CreateProjectDialog onClose={() => setShowCreateDialog(false)} />
				)}
			</>
		);
	}

	return (
		<>
			<main className="mx-auto min-h-screen max-w-7xl px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
				<PanelHeader
					action={
						<div className="flex flex-wrap items-center gap-3">
							<Button onClick={() => setShowModelServices(true)} size="sm" variant="quiet">
								<Settings2 aria-hidden="true" className="h-4 w-4" />
								模型服务
							</Button>
							<Button onClick={() => setShowCreateDialog(true)} size="sm">
								<BookPlus aria-hidden="true" className="h-4 w-4" />
								新建项目
							</Button>
						</div>
					}
					description={`书桌上共有 ${projects.length} ${projects.length === 1 ? "个项目" : "个项目"}。`}
					title="我的项目"
					volume="Volume II · Project Registry"
				/>

				<OrnateDivider className="mb-8" />

				<div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
					{projects.map((project) => (
						<Link href={`/${project.id}`} key={project.id}>
							<Card className="group h-full p-6">
								<div className="flex h-full flex-col gap-4">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<VolumeLabel className="mb-2">
												更新于 {timeAgo(project.updatedAt)}
											</VolumeLabel>
											<h3 className="font-display text-2xl text-ink leading-tight transition-colors group-hover:text-amber">
												{project.title}
											</h3>
										</div>
										{project.genre && <Badge tone="brass">{project.genre}</Badge>}
									</div>

									{project.description ? (
										<p className="line-clamp-3 text-ink-muted text-sm leading-relaxed">
											{project.description}
										</p>
									) : (
										<p className="text-ink-dim text-sm italic">
											尚无简介，留白如初页。
										</p>
									)}

									<div className="mt-auto pt-2">
										<OrnateDivider />
									</div>
								</div>
							</Card>
						</Link>
					))}
				</div>
			</main>

			{showCreateDialog && (
				<CreateProjectDialog onClose={() => setShowCreateDialog(false)} />
			)}

			{showModelServices && (
				<ModelServiceDialog onClose={() => setShowModelServices(false)} />
			)}
		</>
	);
}
