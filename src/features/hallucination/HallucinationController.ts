import type { GameEvent } from "@shared/protocol/game";
import { currentMessages } from "../../i18n";
import { soundBank } from "../audio/soundBank";
import { rumble } from "../gamepad/rumble";
import { hudStore, pushFeedback } from "../hud/hudStore";

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

		const messages = currentMessages().game.hud.visions;

		if (event.until > now) {
			if (!this.active(now)) {
				this.since = now;

				pushFeedback(messages.started, "warning");
				soundBank.play("visions-start", { volume: 0.85 });
				rumble("scare", { scale: 0.5 });
			}

			this.until = event.until;
		} else if (this.until > 0) {
			this.until = 0;

			pushFeedback(messages.ended, "success");
			soundBank.play("visions-end", { volume: 0.7 });
		}

		this.publish(now);
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

			this.publish(now);
		}
	}

	reset(now: number): void {
		this.until = 0;

		this.publish(now);
	}

	private publish(now: number): void {
		hudStore.set({
			visions: this.active(now) ? { until: this.until } : null,
		});
	}
}
