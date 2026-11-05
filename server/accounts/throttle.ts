interface Window {
	count: number;
	resetAt: number;
}

const MAX_TRACKED_KEYS = 20_000;

export class Throttle {
	private readonly windows = new Map<string, Window>();

	constructor(
		readonly limit: number,
		readonly windowMs: number,
	) {}

	retryAfter(key: string, now: number): number {
		const window = this.windows.get(key);
		if (!window || window.resetAt <= now || window.count < this.limit) {
			return 0;
		}
		return window.resetAt - now;
	}

	hit(key: string, now: number): number {
		const blocked = this.retryAfter(key, now);
		if (blocked > 0) {
			return blocked;
		}
		this.record(key, now);
		return 0;
	}

	record(key: string, now: number): void {
		const window = this.windows.get(key);
		if (!window || window.resetAt <= now) {
			if (this.windows.size >= MAX_TRACKED_KEYS) {
				this.prune(now);
			}
			this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
			return;
		}
		window.count += 1;
	}

	reset(key: string): void {
		this.windows.delete(key);
	}

	prune(now: number): void {
		for (const [key, window] of this.windows) {
			if (window.resetAt <= now) {
				this.windows.delete(key);
			}
		}
		if (this.windows.size >= MAX_TRACKED_KEYS) {
			const blocking = (window: Window) => (window.count >= this.limit ? 1 : 0);
			const oldest = [...this.windows.entries()]
				.sort(
					(a, b) =>
						blocking(a[1]) - blocking(b[1]) || a[1].resetAt - b[1].resetAt,
				)
				.slice(0, Math.ceil(MAX_TRACKED_KEYS / 4));
			for (const [key] of oldest) {
				this.windows.delete(key);
			}
		}
	}
}
