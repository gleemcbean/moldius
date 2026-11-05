interface Bucket {
	tokens: number;
	updatedAt: number;
}

export interface RateRule {
	perSecond: number;
	burst: number;
}

export class RateLimiter {
	private readonly buckets = new Map<string, Bucket>();

	constructor(
		private readonly rules: Record<string, RateRule>,
		private readonly fallback: RateRule,
	) {}

	allow(key: string, now: number): boolean {
		const rule = this.rules[key] ?? this.fallback;
		const bucket = this.buckets.get(key) ?? {
			tokens: rule.burst,
			updatedAt: now,
		};
		const elapsed = Math.max(0, now - bucket.updatedAt) / 1000;
		bucket.tokens = Math.min(
			rule.burst,
			bucket.tokens + elapsed * rule.perSecond,
		);
		bucket.updatedAt = now;
		if (bucket.tokens < 1) {
			this.buckets.set(key, bucket);
			return false;
		}
		bucket.tokens -= 1;
		this.buckets.set(key, bucket);
		return true;
	}
}

export const SOCKET_RATE_RULES: Record<string, RateRule> = {
	"game:state": { perSecond: 30, burst: 40 },
	"voice:signal": { perSecond: 60, burst: 120 },
	"time:ping": { perSecond: 4, burst: 8 },
	"game:interact": { perSecond: 8, burst: 10 },
	"game:lantern": { perSecond: 8, burst: 10 },
	"game:cast": { perSecond: 3, burst: 4 },
	"game:castBegin": { perSecond: 4, burst: 6 },
	"game:push": { perSecond: 4, burst: 4 },
	"game:shout": { perSecond: 4, burst: 4 },
};

export const DEFAULT_RATE_RULE: RateRule = { perSecond: 6, burst: 10 };
