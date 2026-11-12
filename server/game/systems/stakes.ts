import {
	HEALTH_MAX,
	MATERIAL_IDS,
	OCCULT_IDS,
	type OccultId,
	PACT_COOLDOWN_MS,
	PACT_HEALTH_COST,
	RELIQUARY_COOLDOWN_MS,
	RELIQUARY_FRAGMENTS,
	SANCTUARY_CALL_INTERVAL_MS,
	SANCTUARY_COOLDOWN_MS,
	SANCTUARY_DURATION_MS,
	SANCTUARY_HEAL_PER_SECOND,
	STAKE_INTERACT_RANGE,
} from "../../../shared/config/index.js";
import type { StakeRoom } from "../../../shared/manor/types.js";
import type { Vec3 } from "../../../shared/math.js";
import type { GameEvent } from "../../../shared/protocol/game.js";
import type { SeededRandom } from "../../../shared/random.js";
import { lureAnomalies } from "../ai/lure.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";

interface StakeState {
	activeUntil: number;
	cooldownUntil: number;
	nextCallAt: number;
	byId: string | null;
}

const ALARM_LOUDNESS = 30;

function callOut(match: Match, stake: StakeRoom, player: string): void {
	const position: Vec3 = { x: stake.x, y: stake.y, z: stake.z };
	lureAnomalies(match, position, player);
	match.sounds.push({
		position,
		loudness: ALARM_LOUDNESS,
		playerId: player,
		kind: "shout",
	});
}

export class StakeSystem {
	private readonly states: StakeState[];
	private rng: SeededRandom | null = null;

	constructor(private readonly stakes: readonly StakeRoom[]) {
		this.states = stakes.map(() => ({
			activeUntil: 0,
			cooldownUntil: 0,
			nextCallAt: 0,
			byId: null,
		}));
	}

	interact(match: Match, player: MatchPlayer, id: number): boolean {
		const stake = this.stakes[id];
		const state = this.states[id];
		if (!stake || !state || player.hidden || match.now < state.cooldownUntil) {
			return false;
		}
		const eye = player.eyePosition();
		if (
			Math.hypot(stake.x - eye.x, stake.y + 0.9 - eye.y, stake.z - eye.z) >
			STAKE_INTERACT_RANGE + 0.5
		) {
			return false;
		}
		switch (stake.kind) {
			case "sanctuary":
				return this.lightSanctuary(match, player, stake, state);
			case "reliquary":
				return this.robReliquary(match, player, stake, state);
			case "pact":
				return this.sealPact(match, player, stake, state);
		}
	}

	private lightSanctuary(
		match: Match,
		player: MatchPlayer,
		stake: StakeRoom,
		state: StakeState,
	): boolean {
		state.activeUntil = match.now + SANCTUARY_DURATION_MS;
		state.cooldownUntil = match.now + SANCTUARY_COOLDOWN_MS;
		state.nextCallAt = match.now + SANCTUARY_CALL_INTERVAL_MS;
		state.byId = player.id;
		callOut(match, stake, player.id);
		this.announce(match, stake, state, player.id);
		return true;
	}

	private robReliquary(
		match: Match,
		player: MatchPlayer,
		stake: StakeRoom,
		state: StakeState,
	): boolean {
		state.cooldownUntil = match.now + RELIQUARY_COOLDOWN_MS;
		this.rng ??= match.rng.fork("stakes");
		for (let count = 0; count < RELIQUARY_FRAGMENTS; count += 1) {
			player.materials[this.rng.pick(MATERIAL_IDS)] += 1;
		}
		match.sendInventory(player);
		match.slamRoomDoors(stake.roomId);
		callOut(match, stake, player.id);
		this.announce(match, stake, state, player.id);
		return true;
	}

	private sealPact(
		match: Match,
		player: MatchPlayer,
		stake: StakeRoom,
		state: StakeState,
	): boolean {
		if (!match.applyDamage(player, PACT_HEALTH_COST, "pact", null, true)) {
			return false;
		}
		state.cooldownUntil = match.now + PACT_COOLDOWN_MS;
		player.objects[this.pactObject(match)] += 1;
		match.sendInventory(player);
		this.announce(match, stake, state, player.id);
		return true;
	}

	private pactObject(match: Match): OccultId {
		this.rng ??= match.rng.fork("stakes");
		const wanted = match.anomalies
			.filter((entity) => entity.active && entity.occult)
			.map((entity) => entity.occult as OccultId);
		return this.rng.pick(wanted.length > 0 ? wanted : OCCULT_IDS);
	}

	private announce(
		match: Match,
		stake: StakeRoom,
		state: StakeState,
		playerId: string,
	): void {
		match.emit({
			type: "stake",
			id: stake.id,
			stake: stake.kind,
			playerId,
			activeUntil: state.activeUntil,
			cooldownUntil: state.cooldownUntil,
		});
	}

	update(match: Match, dt: number): void {
		this.stakes.forEach((stake, id) => {
			const state = this.states[id];
			if (stake.kind !== "sanctuary" || match.now >= state.activeUntil) {
				return;
			}
			for (const player of match.players.values()) {
				if (player.alive && player.roomId === stake.roomId) {
					player.health = Math.min(
						HEALTH_MAX,
						player.health + SANCTUARY_HEAL_PER_SECOND * dt,
					);
				}
			}
			if (match.now >= state.nextCallAt) {
				state.nextCallAt = match.now + SANCTUARY_CALL_INTERVAL_MS;
				callOut(match, stake, state.byId ?? "");
			}
		});
	}

	stateEvents(): GameEvent[] {
		return this.stakes.flatMap((stake, id) => {
			const state = this.states[id];
			return state.cooldownUntil > 0
				? [
						{
							type: "stake" as const,
							id,
							stake: stake.kind,
							playerId: null,
							activeUntil: state.activeUntil,
							cooldownUntil: state.cooldownUntil,
						},
					]
				: [];
		});
	}
}
