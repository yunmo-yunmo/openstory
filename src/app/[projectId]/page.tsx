import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceErrorBoundary } from "~/app/_components/workspace-error-boundary";
import { WorkspaceShell } from "~/app/_components/workspace-shell";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export default async function WorkspacePage({
	params,
}: {
	params: Promise<{ projectId: string }>;
}) {
	const session = await auth();
	if (!session?.user) notFound();

	const { projectId } = await params;

	// Prefetch project data for client hydration
	void api.project.getById.prefetch({ id: projectId });
	void api.chapter.listByProject.prefetch({ projectId });
	void api.session.list.prefetch({ projectId });

	return (
		<HydrateClient>
			<WorkspaceErrorBoundary>
				<Suspense
					fallback={
						<div className="flex h-screen items-center justify-center bg-study-900">
							<p className="font-sans text-ink-dim text-sm">
								正在加载工作区...
							</p>
						</div>
					}
				>
					<WorkspaceShell projectId={projectId} />
				</Suspense>
			</WorkspaceErrorBoundary>
		</HydrateClient>
	);
}
