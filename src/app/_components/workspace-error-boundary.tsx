"use client";

import { Component } from "react";

interface Props {
	children: React.ReactNode;
}

interface State {
	hasError: boolean;
}

export class WorkspaceErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		console.error("[WorkspaceErrorBoundary]", error, info.componentStack);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex h-screen items-center justify-center bg-study-900 px-8">
					<div className="flex flex-col items-center gap-4 text-center">
						<p className="font-display text-ink-muted text-xl">出了点问题</p>
						<p className="font-sans text-ink-dim text-sm">
							工作区遇到了错误，请刷新页面。
						</p>
						<button
							className="mt-2 rounded-sm border border-amber/40 bg-amber/10 px-5 py-2 font-sans text-amber text-sm transition-colors hover:border-amber hover:bg-amber/20"
							onClick={() => window.location.reload()}
							type="button"
						>
							刷新
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
