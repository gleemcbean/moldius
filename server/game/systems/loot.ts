import {
	ALTAR_INTERACT_RANGE,
	type MaterialId,
	OCCULT_RECIPES,
	type OccultId,
	PICKUP_INTERACT_RANGE,
	PICKUP_RESPAWN_MS,
} from "../../../shared/config/index.js";
import type { Vec3 } from "../../../shared/math.js";
import { lineOfSight } from "../../../shared/physics/lineOfSight.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";

function within(player: MatchPlayer, point: Vec3, range: number): boolean {
	const eye = player.eyePosition();
	return Math.hypot(point.x - eye.x, point.y - eye.y, point.z - eye.z) <= range;
}

export function canCraft(player: MatchPlayer, object: OccultId): boolean {
	return Object.entries(OCCULT_RECIPES[object]).every(
		([material, count]) =>
			player.materials[material as MaterialId] >= (count as number),
	);
}

export class LootSystem {
	readonly returnsAt = new Map<number, number>();

	take(match: Match, player: MatchPlayer, pickupId: number): boolean {
		const pickup = match.layout.pickups[pickupId];
		if (
			!pickup ||
			player.hidden ||
			this.returnsAt.has(pickupId) ||
			!within(player, pickup, PICKUP_INTERACT_RANGE + 0.4) ||
			!lineOfSight(match.world, player.eyePosition(), pickup, {
				ignoreFurniture: true,
				blockGlass: true,
			})
		) {
			return false;
		}
		const { material } = pickup;
		player.materials[material] += 1;
		this.returnsAt.set(pickupId, match.now + PICKUP_RESPAWN_MS);
		match.emit({
			type: "pickup",
			id: pickupId,
			playerId: player.id,
			material,
		});
		match.sendInventory(player);
		return true;
	}

	craft(
		match: Match,
		player: MatchPlayer,
		altarId: number,
		object: OccultId,
	): boolean {
		const altar = match.layout.altars[altarId];
		if (
			!altar ||
			player.hidden ||
			!within(
				player,
				{ x: altar.x, y: altar.y + 0.8, z: altar.z },
				ALTAR_INTERACT_RANGE + 0.5,
			) ||
			!canCraft(player, object)
		) {
			return false;
		}
		for (const [material, count] of Object.entries(OCCULT_RECIPES[object])) {
			player.materials[material as MaterialId] -= count as number;
		}
		player.objects[object] += 1;
		match.emit({ type: "craft", playerId: player.id, object, altarId });
		match.sendInventory(player);
		return true;
	}

	update(match: Match): void {
		for (const [pickupId, at] of this.returnsAt) {
			if (match.now >= at) {
				this.returnsAt.delete(pickupId);
				match.emit({ type: "pickupBack", id: pickupId });
			}
		}
	}
}
