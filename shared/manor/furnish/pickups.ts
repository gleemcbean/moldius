import {
	MATERIAL_IDS,
	type MaterialId,
	type OccultRecipe,
	PICKUP_CONTAINER_KINDS,
	PICKUP_MAX_SURFACE_HEIGHT,
	PICKUP_MIN_PER_LEVEL,
	PICKUP_PER_ROOM,
} from "../../config/index.js";
import { rotate2 } from "../../math.js";
import type { SeededRandom } from "../../random.js";
import { furnitureDefinition } from "../furnitureCatalog.js";
import { pointInBox, pointInPolygon } from "../polygon.js";
import type {
	FurnitureItem,
	MaterialPickup,
	PickupSpot,
	Room,
} from "../types.js";

const FLOOR_MARGIN = 0.35;
const WALL_MARGIN = 0.3;

function canHoldLoot(item: FurnitureItem): boolean {
	const definition = furnitureDefinition(item.kind);
	return (
		definition.surface &&
		item.hideSpotId === null &&
		item.height <= PICKUP_MAX_SURFACE_HEIGHT
	);
}

function floorPoint(
	room: Room,
	items: FurnitureItem[],
	rng: SeededRandom,
): { x: number; z: number } | null {
	const { bounds } = room;
	for (let attempt = 0; attempt < 16; attempt += 1) {
		const point = {
			x: rng.range(bounds.minX + WALL_MARGIN, bounds.maxX - WALL_MARGIN),
			z: rng.range(bounds.minZ + WALL_MARGIN, bounds.maxZ - WALL_MARGIN),
		};
		if (
			pointInPolygon(point, room.polygon) &&
			!items.some((item) =>
				item.colliders.some((box) => pointInBox(point, box, FLOOR_MARGIN)),
			) &&
			!items.some((item) => item.kind === "pond")
		) {
			return point;
		}
	}
	return null;
}

type PickupPlace = Omit<MaterialPickup, "id" | "material">;

function placeInRoom(
	room: Room,
	furniture: FurnitureItem[],
	rng: SeededRandom,
): PickupPlace | null {
	const items = furniture.filter((item) => item.roomId === room.id);
	const place = (
		spot: PickupSpot,
		at: { x: number; y: number; z: number },
		furnitureId: number | null,
	): PickupPlace => ({
		spot,
		furnitureId,
		roomId: room.id,
		level: room.level,
		...at,
	});
	const containers = rng.shuffle(
		items.filter((item) => PICKUP_CONTAINER_KINDS.includes(item.kind)),
	);
	const surfaces = rng.shuffle(items.filter(canHoldLoot));
	const roll = rng.next();
	const container = roll < 0.7 ? containers[0] : undefined;
	if (container) {
		return place(
			"container",
			{ x: container.x, y: container.y + container.height, z: container.z },
			container.id,
		);
	}
	const surface = roll < 0.8 ? surfaces[0] : undefined;
	if (surface) {
		const offset = rotate2(
			{
				x: (rng.next() - 0.5) * surface.width * 0.5,
				z: (rng.next() - 0.5) * surface.depth * 0.5,
			},
			surface.rotation,
		);
		return place(
			"surface",
			{
				x: surface.x + offset.x,
				y: surface.y + surface.height + 0.05,
				z: surface.z + offset.z,
			},
			surface.id,
		);
	}
	const point = floorPoint(room, items, rng);
	return point
		? place("floor", { x: point.x, y: room.floorY + 0.05, z: point.z }, null)
		: null;
}

export function placePickups(
	rooms: Room[],
	furniture: FurnitureItem[],
	rng: SeededRandom,
): MaterialPickup[] {
	const places: PickupPlace[] = [];
	const levels = [...new Set(rooms.map((room) => room.level))];
	for (const level of levels) {
		const onLevel = rng.shuffle(
			rooms.filter((room) => room.level === level && room.type !== "stairwell"),
		);
		const target = Math.max(
			PICKUP_MIN_PER_LEVEL,
			Math.round(onLevel.length * PICKUP_PER_ROOM),
		);
		let placed = 0;
		for (const room of onLevel) {
			if (placed >= target) {
				break;
			}
			const place = placeInRoom(room, furniture, rng.fork(`room-${room.id}`));
			if (place) {
				places.push(place);
				placed += 1;
			}
		}
	}
	const deck = rng.shuffle(
		places.map((_, index) => MATERIAL_IDS[index % MATERIAL_IDS.length]),
	);
	return places.map((place, id) => ({ id, material: deck[id], ...place }));
}

export function assignRecipeMaterials(
	pickups: MaterialPickup[],
	recipe: OccultRecipe,
): void {
	const deck = (Object.entries(recipe) as [MaterialId, number][]).flatMap(
		([material, count]) => Array.from({ length: count }, () => material),
	);
	const seen = new Map<number, number>();
	for (const pickup of pickups) {
		const index = seen.get(pickup.level) ?? 0;
		seen.set(pickup.level, index + 1);
		pickup.material = deck[index % deck.length];
	}
}
