import type {
	FloorStyle,
	LightSource,
	ManorLayout,
	Room,
	RoomType,
	WallStyle,
} from "@shared/manor/types";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import { countWallsBetween } from "@shared/physics/lineOfSight";
import * as THREE from "three";
import { audioEngine, type ReverbPreset } from "../../audio/audioEngine";
import { type SoundHandle, soundBank } from "../../audio/soundBank";

const STONE_FLOORS = new Set<FloorStyle>([
	"stoneFlags",
	"cobble",
	"checkerTiles",
	"mosaic",
	"greenhouseTiles",
]);

const HARD_WALLS = new Set<WallStyle>([
	"stoneBlocks",
	"brick",
	"tiles",
	"greenhouseBrick",
	"rubbleStone",
	"mossyBrick",
]);

const ROOM_TONES: Partial<Record<RoomType, { id: string; volume: number }>> = {
	greenhouse: { id: "rain-glass-loop", volume: 0.32 },
	observatory: { id: "rain-glass-loop", volume: 0.22 },
	crypt: { id: "crypt-rumble-loop", volume: 0.3 },
	dungeon: { id: "crypt-rumble-loop", volume: 0.28 },
	pond: { id: "pond-water-loop", volume: 0.22 },
	undercroft: { id: "crypt-rumble-loop", volume: 0.26 },
	cellar: { id: "crypt-rumble-loop", volume: 0.16 },
	chapel: { id: "organ-drone-loop", volume: 0.17 },
	ritual: { id: "organ-drone-loop", volume: 0.12 },
	kitchen: { id: "pipes-loop", volume: 0.18 },
	laundry: { id: "pipes-loop", volume: 0.22 },
	bathroom: { id: "pipes-loop", volume: 0.2 },
	toilets: { id: "pipes-loop", volume: 0.22 },
	attic: { id: "attic-wind-loop", volume: 0.24 },
	nursery: { id: "music-box-loop", volume: 0.16 },
	ballroom: { id: "music-box-loop", volume: 0.1 },
};

export function footstepSound(floor: FloorStyle | undefined): string {
	return floor === "redCarpet"
		? "step-soft"
		: floor && STONE_FLOORS.has(floor)
			? "step-stone"
			: "step-wood";
}

export function acousticsOf(room: Room): ReverbPreset {
	const hard =
		STONE_FLOORS.has(room.style.floor) || HARD_WALLS.has(room.style.wall);
	const soft = room.style.floor === "redCarpet";
	const size = Math.sqrt(Math.max(1, room.area * room.height));
	const seconds =
		Math.round(
			Math.min(3.2, Math.max(0.4, 0.4 + size * (hard ? 0.09 : 0.055))) * 5,
		) / 5;
	return {
		seconds,
		brightness: hard ? 5200 : soft ? 1800 : 3200,
		wet: (hard ? 0.34 : soft ? 0.16 : 0.22) * (room.height < 2.7 ? 0.7 : 1),
	};
}

const RANDOM_EVENTS = [
	{ id: "creak", weight: 5, volume: 0.36 },
	{ id: "thump", weight: 2, volume: 0.3 },
	{ id: "whisper-far", weight: 2, volume: 0.27 },
	{ id: "drip", weight: 3, volume: 0.22 },
	{ id: "moan-far", weight: 2, volume: 0.24 },
	{ id: "chains-far", weight: 2, volume: 0.2 },
] as const;

export class AmbientAudio {
	private drone: SoundHandle | null = null;
	private wind: SoundHandle | null = null;
	private fire: SoundHandle | null = null;
	private fireSource: LightSource | null = null;
	private water: SoundHandle | null = null;
	private clock: SoundHandle | null = null;
	private clockSource: THREE.Vector3 | null = null;
	private roomTone: { id: string; handle: SoundHandle | null } | null = null;
	private roomId: number | null = null;
	private readonly clocks: THREE.Vector3[];
	private heartbeatAt = 0;
	private nextEventAt = 4;
	private stepDistance = 0;
	private time = 0;
	private readonly fires: LightSource[];

	constructor(
		layout: ManorLayout,
		private readonly world: CollisionWorld,
	) {
		this.fires = layout.lights.filter((light) => light.kind === "fire");
		this.clocks = layout.furniture
			.filter((item) => item.kind === "grandfatherClock")
			.map(
				(item) =>
					new THREE.Vector3(item.x, item.y + item.height - 0.26, item.z),
			);
	}

	start(): void {
		this.drone = soundBank.play("drone-loop", {
			bus: "ambience",
			loop: true,
			volume: 0.36,
		});
		this.wind = soundBank.play("wind-loop", {
			bus: "ambience",
			loop: true,
			volume: 0.12,
		});
	}

	update(
		dt: number,
		listener: THREE.Vector3,
		room: Room | null,
		options: {
			stepSpeed: number;
			grounded: boolean;
			crouching: boolean;
			slimed: boolean;
			wading: boolean;
			tension: number;
			lowHealth: boolean;
			waterAt: THREE.Vector3 | null;
		},
	): void {
		this.time += dt;
		this.updateRoom(room);
		this.updateClock(listener);
		this.updateFootsteps(dt, room, options);
		this.updateRandomEvents(listener);
		this.updateFire(listener);
		this.updateWater(options.waterAt);
		const exterior = room?.exteriorEdges.some(Boolean) ?? false;
		this.wind?.setVolume(exterior ? 0.19 : 0.08);
		this.drone?.setVolume(0.26 + options.tension * 0.24);
		if (
			(options.tension > 0.5 || options.lowHealth) &&
			this.time - this.heartbeatAt > (options.tension > 0.5 ? 0.75 : 1.1)
		) {
			this.heartbeatAt = this.time;
			soundBank.play("heartbeat", {
				bus: "effects",
				volume: 0.45 + options.tension * 0.3,
			});
		}
	}

	private updateFootsteps(
		dt: number,
		room: Room | null,
		options: {
			stepSpeed: number;
			grounded: boolean;
			crouching: boolean;
			slimed: boolean;
			wading: boolean;
		},
	): void {
		if (!options.grounded || options.stepSpeed < 0.5) {
			this.stepDistance = Math.min(this.stepDistance, 0.4);
			return;
		}
		this.stepDistance += options.stepSpeed * dt;
		const stride = options.crouching
			? 0.55
			: options.stepSpeed > 4
				? 0.95
				: 0.72;
		if (this.stepDistance < stride) {
			return;
		}
		this.stepDistance = 0;
		const id = options.wading
			? "step-water"
			: options.slimed
				? "step-slime"
				: footstepSound(room?.style.floor);
		soundBank.play(id, {
			volume: options.crouching ? 0.22 : options.stepSpeed > 4 ? 0.7 : 0.45,
			rate: 0.9 + Math.random() * 0.2,
		});
	}

	private updateRoom(room: Room | null): void {
		if (!room || room.id === this.roomId) {
			return;
		}
		this.roomId = room.id;
		audioEngine.setReverb(acousticsOf(room));
		const tone = ROOM_TONES[room.type];
		if (tone?.id === this.roomTone?.id) {
			this.roomTone?.handle?.setVolume(tone?.volume ?? 0);
			return;
		}
		this.roomTone?.handle?.stop(1.6);
		if (!tone) {
			this.roomTone = null;
			return;
		}
		const handle = soundBank.play(tone.id, {
			bus: "ambience",
			loop: true,
			volume: 0.0001,
		});
		handle?.gain.gain.setTargetAtTime(
			tone.volume,
			handle.gain.context.currentTime,
			0.6,
		);
		this.roomTone = { id: tone.id, handle };
	}

	private updateClock(listener: THREE.Vector3): void {
		let nearest: THREE.Vector3 | null = null;
		let best = 10;
		for (const clock of this.clocks) {
			const distance = clock.distanceTo(listener);
			if (distance < best) {
				best = distance;
				nearest = clock;
			}
		}
		if (nearest === this.clockSource) {
			return;
		}
		this.clock?.stop(0.4);
		this.clock = nearest
			? soundBank.play("clock-loop", {
					position: nearest,
					bus: "ambience",
					loop: true,
					volume: 0.38,
					refDistance: 1.2,
					maxDistance: 12,
				})
			: null;
		this.clockSource = nearest;
	}

	private updateRandomEvents(listener: THREE.Vector3): void {
		if (this.time < this.nextEventAt) {
			return;
		}
		this.nextEventAt = this.time + 5 + Math.random() * 11;
		const total = RANDOM_EVENTS.reduce((sum, event) => sum + event.weight, 0);
		let roll = Math.random() * total;
		const event =
			RANDOM_EVENTS.find((candidate) => (roll -= candidate.weight) <= 0) ??
			RANDOM_EVENTS[0];
		const angle = Math.random() * Math.PI * 2;
		const distance = 4 + Math.random() * 10;
		const position = new THREE.Vector3(
			listener.x + Math.cos(angle) * distance,
			listener.y + Math.random() * 1.5,
			listener.z + Math.sin(angle) * distance,
		);
		const occlusion = countWallsBetween(this.world, listener, position, 3);
		soundBank.play(event.id, {
			bus: "ambience",
			position,
			volume: event.volume,
			occlusion,
			refDistance: 3,
			maxDistance: 30,
		});
	}

	private updateFire(listener: THREE.Vector3): void {
		let nearest: LightSource | null = null;
		let best = 9;
		for (const fire of this.fires) {
			const distance = Math.hypot(
				fire.position.x - listener.x,
				fire.position.y - listener.y,
				fire.position.z - listener.z,
			);
			if (distance < best) {
				best = distance;
				nearest = fire;
			}
		}
		if (nearest !== this.fireSource) {
			this.fire?.stop(0.5);
			this.fire = nearest
				? soundBank.play("fire-loop", {
						position: nearest.position,
						bus: "ambience",
						loop: true,
						volume: 0.42,
						refDistance: 1.5,
						maxDistance: 12,
					})
				: null;
			this.fireSource = nearest;
		}
	}

	private updateWater(position: THREE.Vector3 | null): void {
		if (position && !this.water) {
			this.water = soundBank.play("water-loop", {
				position,
				bus: "ambience",
				loop: true,
				volume: 0.5,
				refDistance: 1.5,
				maxDistance: 18,
			});
		} else if (!position && this.water) {
			this.water.stop(0.4);
			this.water = null;
		} else if (position && this.water) {
			this.water.setPosition(position.x, position.y, position.z);
		}
	}

	dispose(): void {
		for (const handle of [
			this.drone,
			this.wind,
			this.fire,
			this.water,
			this.clock,
			this.roomTone?.handle ?? null,
		]) {
			handle?.stop(0.3);
		}
		audioEngine.setReverb({ seconds: 0.4, brightness: 3200, wet: 0 });
	}
}
