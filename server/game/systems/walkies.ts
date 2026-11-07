import {
	PICKUP_INTERACT_RANGE,
	WALKIE_RECEIVER_LOUDNESS,
	WALKIE_RETURN_MS,
	WALKIE_VOICE_LOUDNESS,
	VOICE_AUDIBLE_LEVEL,
} from "../../../shared/config/index.js";
import type { GameEvent } from "../../../shared/protocol/game.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";

interface WalkieState {
	holder: string | null;
	returnsAt: number | null;
}

export class WalkieSystem {
	private readonly states = new Map<number, WalkieState>();

	constructor(spotIds: readonly number[]) {
		for (const id of spotIds) {
			this.states.set(id, { holder: null, returnsAt: null });
		}
	}

	take(match: Match, player: MatchPlayer, id: number): boolean {
		const state = this.states.get(id);
		const spot = match.layout.walkies[id];
		if (
			!state ||
			!spot ||
			state.holder !== null ||
			state.returnsAt !== null ||
			player.hidden ||
			player.walkie >= 0
		) {
			return false;
		}
		const eye = player.eyePosition();
		if (
			Math.hypot(spot.x - eye.x, spot.y - eye.y, spot.z - eye.z) >
			PICKUP_INTERACT_RANGE + 0.4
		) {
			return false;
		}
		state.holder = player.id;
		player.walkie = id;
		match.emit({ type: "walkie", id, holder: player.id, available: false });
		return true;
	}

	/** Mort ou déconnecté : le talkie retourne à sa place d'origine, après un temps. */
	release(match: Match, player: MatchPlayer): void {
		const state = this.states.get(player.walkie);
		if (!state) {
			return;
		}
		const id = player.walkie;
		player.walkie = -1;
		player.radioOn = false;
		state.holder = null;
		state.returnsAt = match.now + WALKIE_RETURN_MS;
		match.emit({ type: "walkie", id, holder: null, available: false });
	}

	setTransmitting(player: MatchPlayer, on: boolean): void {
		player.radioOn = on && player.walkie >= 0 && player.alive && !player.carried;
	}

	update(match: Match): void {
		for (const [id, state] of this.states) {
			if (state.returnsAt !== null && match.now >= state.returnsAt) {
				state.returnsAt = null;
				match.emit({ type: "walkie", id, holder: null, available: true });
			}
		}
		const holders = [...match.players.values()].filter(
			(player) => player.walkie >= 0 && player.alive,
		);
		for (const speaker of holders) {
			if (!speaker.radioOn) {
				continue;
			}
			const level = speaker.voiceLevelNow(match.now);
			if (level < VOICE_AUDIBLE_LEVEL) {
				continue;
			}
			const voice = (level - VOICE_AUDIBLE_LEVEL) / (1 - VOICE_AUDIBLE_LEVEL);
			for (const receiver of holders) {
				if (receiver === speaker) {
					continue;
				}
				receiver.radioNoiseAt = match.now;
				match.sounds.push({
					position: { ...receiver.position },
					loudness: WALKIE_RECEIVER_LOUDNESS + voice * WALKIE_VOICE_LOUDNESS,
					playerId: receiver.id,
					kind: "voice",
				});
			}
		}
	}

	stateEvents(): GameEvent[] {
		return [...this.states].map(([id, state]) => ({
			type: "walkie",
			id,
			holder: state.holder,
			available: state.holder === null && state.returnsAt === null,
		}));
	}
}
