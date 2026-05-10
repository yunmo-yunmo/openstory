import { Suspense } from "react";
import { ProjectDashboard } from "~/app/_components/project-dashboard";
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
		<main className="flex min-h-screen flex-col items-center justify-center bg-study-900 px-6">
			<div className="flex flex-col items-center gap-10 text-center">
				{/* Title */}
				<h1 className="font-display text-6xl text-ink tracking-wide sm:text-7xl lg:text-8xl">
					Open<span className="text-amber">Story</span>
				</h1>

				{/* Decorative amber rule */}
				<div className="flex w-full max-w-md items-center gap-4">
					<div className="h-px flex-1 bg-gradient-to-r from-transparent via-study-600 to-study-600" />
					<div className="h-1 w-10 rounded-full bg-amber" />
					<div className="h-px flex-1 bg-gradient-to-l from-transparent via-study-600 to-study-600" />
				</div>

				{/* Subtitle */}
				<p className="font-display text-2xl text-ink-muted italic tracking-wide">
					小说创作，由此点亮
				</p>

				{/* Description */}
				<p className="max-w-md text-base text-ink-dim leading-relaxed">
					一处安静的角落，用来书写、规划与探索你的故事。AI 合著者已在灯下等候。
				</p>

				<div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
					{discordSignInAvailable && (
						<form
							action={async () => {
								"use server";
								await signIn("discord");
							}}
						>
							<button
								className="group relative inline-flex items-center gap-3 rounded-sm border border-study-600 bg-study-800 px-8 py-3 font-sans text-ink transition-all duration-300 hover:border-amber/50 hover:bg-study-700 hover:text-amber-light hover:shadow-[0_0_24px_var(--color-amber-glow)]"
								type="submit"
							>
								<svg
									aria-hidden="true"
									className="h-5 w-5 text-ink-muted transition-colors group-hover:text-amber"
									fill="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
								</svg>
								通过 Discord 登录
							</button>
						</form>
					)}

					{localUserModeEnabled && (
						<form
							action={async () => {
								"use server";
								await signIn("local-user", { redirectTo: "/" });
							}}
						>
							<button
								className="group relative inline-flex items-center gap-3 rounded-sm border border-study-600 bg-study-800 px-8 py-3 font-sans text-ink transition-all duration-300 hover:border-amber/50 hover:bg-study-700 hover:text-amber-light hover:shadow-[0_0_24px_var(--color-amber-glow)]"
								type="submit"
							>
								本地继续
							</button>
						</form>
					)}
				</div>
			</div>
		</main>
	);
}
