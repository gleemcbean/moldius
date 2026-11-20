import {
	MANOR_EVENT_DURATION_MS,
	MANOR_EVENT_END_MARGIN_MS,
	MANOR_EVENT_FIRST_MS,
	MANOR_EVENT_GAP_JITTER_MS,
	MANOR_EVENT_GAP_MS,
	MANOR_EVENT_KINDS,
	MANOR_EVENT_WARNING_MS,
	type ManorEventKind,
} from "../../../shared/config/index.js";
import type { GameEvent } from "../../../shared/protocol/game.js";
import type { SeededRandom } from "../../../shared/random.js";
import type { Match } from "../Match.js";

interface ScheduledEvent {
	kind: ManorEventKind;
	startsAt: number;
	endsAt: number;
}

export class ManorEventSystem {
	current: ScheduledEvent | null = null;
	pending: ScheduledEvent | null = null;
	nextAt = Infinity;
	private last: ManorEventKind | null = null;
	private rng: SeededRandom | null = null;

	constructor(private readonly enabled: boolean) {}

	start(match: Match): void {
		if (!this.enabled) {
			return;
		}

		this.rng = match.rng.fork("manor-events");

		const duration = match.endsAt - match.startedAt;

		this.nextAt =
			match.startedAt + Math.min(MANOR_EVENT_FIRST_MS, duration * 0.3);
	}

	active(kind: ManorEventKind, now: number): boolean {
		return (
			this.current !== null &&
			this.current.kind === kind &&
			now >= this.current.startsAt &&
			now < this.current.endsAt
		);
	}

	update(match: Match): void {
		if (!this.enabled || !this.rng) {
			return;
		}

		const now = match.now;

		if (this.current && now >= this.current.endsAt) {
			const ended = this.current;

			this.current = null;

			match.emit({ type: "manorEvent", phase: "end", ...ended });

			this.nextAt =
				now + MANOR_EVENT_GAP_MS + this.rng.range(0, MANOR_EVENT_GAP_JITTER_MS);
		}

		if (this.pending && now >= this.pending.startsAt) {
			this.current = this.pending;
			this.pending = null;

			this.begin(match, this.current);
			match.emit({ type: "manorEvent", phase: "start", ...this.current });

			return;
		}

		if (
			this.current ||
			this.pending ||
			now < this.nextAt - MANOR_EVENT_WARNING_MS
		) {
			return;
		}

		const kind = this.choose(match);
		const startsAt = now + MANOR_EVENT_WARNING_MS;
		const endsAt = startsAt + MANOR_EVENT_DURATION_MS[kind];

		if (endsAt + MANOR_EVENT_END_MARGIN_MS > match.endsAt) {
			this.nextAt = Infinity;

			return;
		}

		this.last = kind;
		this.pending = { kind, startsAt, endsAt };

		match.emit({ type: "manorEvent", phase: "warning", ...this.pending });
	}

	stateEvents(): GameEvent[] {
		const events: GameEvent[] = [];

		if (this.pending) {
			events.push({ type: "manorEvent", phase: "warning", ...this.pending });
		}

		if (this.current) {
			events.push({ type: "manorEvent", phase: "start", ...this.current });
		}

		return events;
	}

	private choose(match: Match): ManorEventKind {
		const rng = this.rng as SeededRandom;

		const available = MANOR_EVENT_KINDS.filter((kind) => {
			if (kind === this.last) {
				return false;
			}

			if (kind === "fragmentRain") {
				return match.loot.returnsAt.size >= 3;
			}

			if (kind === "greenTide") {
				return match.valves.valves.length > 0;
			}

			if (kind === "lockdown") {
				return match.doors.doors.some(Boolean);
			}

			return true;
		});

		const pool: readonly ManorEventKind[] =
			available.length > 0 ? available : ["bloodMoon"];

		return rng.pick(pool);
	}

	private begin(match: Match, event: ScheduledEvent): void {
		switch (event.kind) {
			case "lockdown":
				match.slamAllDoors();
				break;

			case "fragmentRain":
				for (const pickupId of match.loot.returnsAt.keys()) {
					match.loot.returnsAt.set(pickupId, match.now);
				}

				break;

			case "greenTide":
				match.valves.valves.forEach((_valve, valveId) => {
					const activated = match.valves.activate(valveId, match.now);

					if (activated) {
						match.emit({
							type: "valve",
							valveId,
							activeUntil: activated.activeUntil,
							cooldownUntil: activated.cooldownUntil,
						});
					}
				});

				break;

			default:
				break;
		}
	}
}
