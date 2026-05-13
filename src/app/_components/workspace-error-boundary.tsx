"use client";

import { Component } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";

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
				<div className="flex min-h-screen items-center justify-center px-6">
					<EmptyState
						action={
							<Button onClick={() => window.location.reload()} size="lg">
								<RefreshCcw aria-hidden="true" className="h-4 w-4" />
								刷新页面
							</Button>
						}
						description="工作区遇到了错误，请刷新页面。"
						title="出了点问题"
						volume="Volume V · Fault Registry"
					/>
				</div>
			);
		}

		return this.props.children;
	}
}
