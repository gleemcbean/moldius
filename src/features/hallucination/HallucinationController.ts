import type { GameEvent } from "@shared/protocol/game";

const FADE_IN_MS = 1_800;
const FADE_OUT_MS = 2_500;

type VisionsEvent = Extract<GameEvent, { type: "hallucination" }>;

export class HallucinationController {
	private until = 0;
	private since = 0;

	constructor(private readonly selfId: string) {}

	handle(event: VisionsEvent, now: number): void {
		if (event.playerId !== this.selfId) {
			return;
		}

		if (event.until > now) {
			if (!this.active(now)) {
				this.since = now;
			}

			this.until = event.until;
		} else {
			this.until = 0;
		}
	}

	active(now: number): boolean {
		return this.until > now;
	}

	strength(now: number): number {
		if (!this.active(now)) {
			return 0;
		}

		return Math.min(
			1,
			(now - this.since) / FADE_IN_MS,
			(this.until - now) / FADE_OUT_MS,
		);
	}

	update(now: number): void {
		if (this.until > 0 && !this.active(now)) {
			this.until = 0;
		}
	}

	reset(): void {
		this.until = 0;
	}
}
