import { BookOpen, LogIn, ScrollText } from "lucide-react";
import { Suspense } from "react";
import { ProjectDashboard } from "~/app/_components/project-dashboard";
import { Button } from "~/app/_components/ui/button";
import { OrnateDivider, VolumeLabel } from "~/app/_components/ui/decorative";
import { WorkspaceErrorBoundary } from "~/app/_components/workspace-error-boundary";
import { env } from "~/env";
import { auth, signIn } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
	const session = await auth();
	const discordSignInAvailable = Boolean(
		env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET,
	);
	const localUserModeEnabled = env.ENABLE_LOCAL_USER_MODE === "true";

	if (session?.user) {
		void api.project.list.prefetch();

		return (
			<HydrateClient>
				<main className="min-h-screen bg-study-900">
					<WorkspaceErrorBoundary>
						<Suspense
							fallback={
								<div className="flex h-screen items-center justify-center">
									<p className="font-sans text-ink-dim text-sm">加载中...</p>
								</div>
							}
						>
							<ProjectDashboard />
						</Suspense>
					</WorkspaceErrorBoundary>
				</main>
			</HydrateClient>
		);
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-study-900 px-6 py-16">
			<section className="ornate-frame flex w-full max-w-4xl flex-col items-center gap-10 border border-study-600 bg-study-800/45 px-8 py-14 text-center shadow-[0_20px_80px_rgba(0,0,0,0.28)] sm:px-12">
				<div className="flex h-20 w-20 items-center justify-center rounded-full border border-amber/30 bg-study-900 text-amber shadow-[var(--brass-shadow)]">
					<BookOpen aria-hidden="true" className="h-9 w-9" strokeWidth={1.5} />
				</div>

				<div className="flex flex-col items-center gap-4">
					<VolumeLabel>Volume I · The Writing Study</VolumeLabel>
					<h1 className="font-display text-6xl text-ink leading-none tracking-wide sm:text-7xl lg:text-8xl">
						Open<span className="engraved text-amber">Story</span>
					</h1>
					<OrnateDivider className="w-full max-w-md" />
					<p className="font-display text-2xl text-ink-muted italic tracking-wide">
						小说创作，由此点亮
					</p>
				</div>

				<p className="drop-cap max-w-2xl text-left text-base text-ink-muted leading-relaxed sm:text-lg">
					一处安静的角落，用来书写、规划与探索你的故事。AI
					合著者已在灯下等候，像图书馆深处的一盏黄铜台灯，照亮章节、角色与世界设定之间的线索。
				</p>

				<div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
					{discordSignInAvailable && (
						<form
							action={async () => {
								"use server";
								await signIn("discord");
							}}
						>
							<Button size="lg" type="submit">
								<LogIn aria-hidden="true" className="h-4 w-4" />
								通过 Discord 登录
							</Button>
						</form>
					)}

					{localUserModeEnabled && (
						<form
							action={async () => {
								"use server";
								await signIn("local-user", { redirectTo: "/" });
							}}
						>
							<Button size="lg" type="submit">
								<ScrollText aria-hidden="true" className="h-4 w-4" />
								本地继续
							</Button>
						</form>
					)}
				</div>
			</section>
		</main>
	);
}
