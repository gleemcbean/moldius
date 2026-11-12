import {
	CAMERA_RETURN_MS,
	PICKUP_INTERACT_RANGE,
} from "../../../shared/config/index.js";
import type { GameEvent } from "../../../shared/protocol/game.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";

interface CameraState {
	holder: string | null;
	returnsAt: number | null;
}

export class CameraSystem {
	private readonly states = new Map<number, CameraState>();

	constructor(spotIds: readonly number[]) {
		for (const id of spotIds) {
			this.states.set(id, { holder: null, returnsAt: null });
		}
	}

	take(match: Match, player: MatchPlayer, id: number): boolean {
		const state = this.states.get(id);
		const spot = match.layout.cameras[id];
		if (
			!state ||
			!spot ||
			state.holder !== null ||
			state.returnsAt !== null ||
			player.hidden ||
			player.camera >= 0
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
		player.camera = id;
		match.emit({ type: "camera", id, holder: player.id, available: false });
		return true;
	}

	release(match: Match, player: MatchPlayer): void {
		const state = this.states.get(player.camera);
		if (!state) {
			return;
		}
		const id = player.camera;
		player.camera = -1;
		state.holder = null;
		state.returnsAt = match.now + CAMERA_RETURN_MS;
		match.emit({ type: "camera", id, holder: null, available: false });
	}

	update(match: Match): void {
		for (const [id, state] of this.states) {
			if (state.returnsAt !== null && match.now >= state.returnsAt) {
				state.returnsAt = null;
				match.emit({ type: "camera", id, holder: null, available: true });
			}
		}
	}

	stateEvents(): GameEvent[] {
		return [...this.states].map(([id, state]) => ({
			type: "camera",
			id,
			holder: state.holder,
			available: state.holder === null && state.returnsAt === null,
		}));
	}
}
