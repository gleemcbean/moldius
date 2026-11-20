import {
	CompulsionDriver,
	compelsMovement,
} from "@shared/anomalies/compulsion";
import { approachAngle } from "@shared/math";
import type { CompulsionKind, GameEvent } from "@shared/protocol/game";
import { currentMessages } from "../../i18n";
import { soundBank } from "../audio/soundBank";
import type { LocalControls, LocalPlayer } from "../engine/player/LocalPlayer";
import { rumble } from "../gamepad/rumble";
import { hudStore, pushFeedback } from "../hud/hudStore";

const TURN_RATE = 6.5;
const SHAKE_DECAY = 1.6;

type InfectionEvent = Extract<GameEvent, { type: "infection" | "compulsion" }>;

export class InfectionController {
	private infectedUntil = 0;
	private driver: CompulsionDriver | null = null;
	private shake = 0;

	constructor(private readonly selfId: string) {}

	get compulsion(): CompulsionKind | null {
		return this.driver?.order.kind ?? null;
	}

	handle(event: InfectionEvent, now: number): void {
		if (event.type === "compulsion") {
			this.onCompulsion(event, now);
		} else if (event.playerId === this.selfId) {
			this.onInfection(event.until, now);
		}
	}

	private onInfection(until: number, now: number): void {
		const messages = currentMessages().game.hud.infection;

		if (until > now) {
			this.infectedUntil = until;

			pushFeedback(messages.infected, "error");
			soundBank.play("infection-bite", { volume: 0.9 });
			rumble("hit");
		} else if (this.infectedUntil > 0) {
			this.infectedUntil = 0;
			this.driver = null;

			pushFeedback(messages.cured, "success");
		}

		this.publish(now);
	}

	private onCompulsion(
		event: Extract<GameEvent, { type: "compulsion" }>,
		now: number,
	): void {
		if (event.playerId !== this.selfId) {
			return;
		}

		const messages = currentMessages().game.hud.infection;

		if (event.until <= now) {
			if (this.driver) {
				pushFeedback(messages.freed, "success");
			}

			this.driver = null;

			this.publish(now);

			return;
		}

		this.driver = new CompulsionDriver({
			kind: event.kind,
			until: event.until,
			path: event.path,
			leap: event.leap,
		});

		this.shake = 1;

		pushFeedback(messages[event.kind], "warning");
		soundBank.play("compulsion-pulse", { volume: 0.85 });
		rumble("scare", { scale: 0.6 });

		this.publish(now);
	}

	steer(
		controls: LocalControls,
		player: LocalPlayer,
		now: number,
		dt: number,
	): void {
		this.shake = Math.max(0, this.shake - dt * SHAKE_DECAY);

		if (this.driver && !this.driver.activeAt(now)) {
			this.driver = null;

			this.publish(now);
		}

		if (!this.driver || !compelsMovement(this.driver.order.kind)) {
			return;
		}

		const steer = this.driver.steer(player.position, now);

		controls.forward = steer.forward;
		controls.strafe = 0;
		controls.sprint = steer.sprint;
		controls.jump = steer.jump;
		controls.crouch = false;
		controls.lookX *= 0.15;
		controls.lookY *= 0.15;

		if (steer.yaw !== null) {
			player.yaw = approachAngle(player.yaw, steer.yaw, TURN_RATE * dt);
		}
	}

	cameraShake(time: number): number {
		const active = this.driver !== null ? 0.35 : 0;
		const amount = Math.max(active, this.shake);

		return Math.sin(time * 31) * Math.sin(time * 17.3) * 0.02 * amount;
	}

	reset(now: number): void {
		this.infectedUntil = 0;
		this.driver = null;
		this.shake = 0;

		this.publish(now);
	}

	private publish(now: number): void {
		hudStore.set({
			infection:
				this.infectedUntil > now
					? { until: this.infectedUntil, compelled: this.driver !== null }
					: null,
		});
	}
}
