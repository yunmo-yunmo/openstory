import "server-only";

export class RateLimiter {
	private timestamps: number[] = [];

	constructor(private config: { maxRequests: number; windowMs: number }) {}

	async acquire(): Promise<void> {
		const now = Date.now();
		this.timestamps = this.timestamps.filter(
			(t) => now - t < this.config.windowMs,
		);
		if (this.timestamps.length >= this.config.maxRequests) {
			const oldest = this.timestamps[0] ?? now;
			const waitMs = this.config.windowMs - (now - oldest);
			if (waitMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, waitMs));
			}
			// Re-filter and re-check after waiting
			const afterWait = Date.now();
			this.timestamps = this.timestamps.filter(
				(t) => afterWait - t < this.config.windowMs,
			);
		}
		this.timestamps.push(Date.now());
	}
}

export const defaultRateLimiter = new RateLimiter({
	maxRequests: 10,
	windowMs: 60_000,
});
