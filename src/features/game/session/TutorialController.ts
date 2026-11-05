import {
	EYE_HEIGHT_STANDING,
	type MaterialId,
	OCCULT_RECIPES,
	type OccultId,
} from "@shared/config/index";
import { SPECIES } from "@shared/config/species";
import type { Vec3 } from "@shared/math";
import { wrapAngle } from "@shared/math";
import type { MatchInit, PlayerInventory } from "@shared/protocol/game";
import * as THREE from "three";
import { keyLabel } from "../../../config/controls";
import { currentMessages } from "../../../i18n";
import type { FrameInput } from "../../engine/input/InputManager";
import { hudStore, type TutorialCheck } from "../../hud/hudStore";
import { settingsStore } from "../../settings/settingsStore";
import { micManager } from "../../voice/micManager";
import type { LoadedWorld } from "./SessionLoader";

export const TUTORIAL_STEPS = [
	"move",
	"lantern",
	"door",
	"loot",
	"grimoire",
	"altar",
	"hold",
	"hide",
	"shout",
	"capture",
	"end",
] as const;

export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

export interface TutorialFrame {
	frame: FrameInput;
	feet: Vec3;
	yaw: number;
	hidden: boolean;
	inventory: PlayerInventory | null;
	heldObject: OccultId | null;
	lanternOpen: boolean;
	dt: number;
}

const MOVE_DISTANCE = 4;
const GRIMOIRE_READ_MS = 2500;
const SAME_FLOOR = 2;
const STAR_SCALE = 0.035;
const STAR_HEIGHT = 1.5;
const CAPTURE_LANTERN = "closed";
const VOICE_HEARD_LEVEL = 0.08;
const VOICE_MEMORY_MS = 2500;

function starCanvas(): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	context.beginPath();
	for (let index = 0; index < 10; index += 1) {
		const radius = index % 2 === 0 ? 30 : 11;
		const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
		context.lineTo(
			32 + Math.cos(angle) * radius,
			32 + Math.sin(angle) * radius,
		);
	}
	context.closePath();
	context.fillStyle = "#ffe07a";
	context.strokeStyle = "#5a3c08";
	context.lineWidth = 2;
	context.fill();
	context.stroke();
	return canvas;
}

export class TutorialController {
	private index = 0;
	private travelled = 0;
	private last: Vec3 | null = null;
	private readSince = 0;
	private wasHidden = false;
	private skip = false;
	private doorUsed = false;
	private captured = false;
	private finished = false;
	private lastPublished = "";
	private readonly star: THREE.Sprite;
	private readonly starTexture: THREE.CanvasTexture;
	private time = 0;
	private voiceHeardAt = 0;
	private inventory: PlayerInventory | null = null;

	constructor(
		private readonly init: MatchInit,
		private readonly loaded: LoadedWorld,
		private readonly summon: () => void,
	) {
		this.starTexture = new THREE.CanvasTexture(starCanvas());
		this.starTexture.colorSpace = THREE.SRGBColorSpace;
		this.star = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: this.starTexture,
				transparent: true,
				depthTest: false,
				depthWrite: false,
				fog: false,
				sizeAttenuation: false,
			}),
		);
		this.star.scale.setScalar(STAR_SCALE);
		this.star.renderOrder = 10;
		this.star.visible = false;
		loaded.scene.add(this.star);
		window.addEventListener("keydown", this.onKeyDown, true);
	}

	private readonly onKeyDown = (event: KeyboardEvent) => {
		if (event.code === "Enter") {
			this.skip = true;
		}
	};

	get step(): TutorialStep {
		return TUTORIAL_STEPS[this.index];
	}

	notify(event: "door" | "captured"): void {
		if (event === "door") {
			this.doorUsed = true;
		} else {
			this.captured = true;
		}
	}

	update(context: TutorialFrame): void {
		this.inventory = context.inventory;
		if (this.isDone(context) || this.skip) {
			this.skip = false;
			if (this.step === "end") {
				this.finished = true;
			} else {
				this.index += 1;
				if (this.step === "shout" || this.step === "capture") {
					this.summon();
				}
			}
		}
		const target = this.finished ? null : this.targetFor(context.feet);
		this.time += context.dt;
		this.star.visible = target !== null;
		if (target) {
			this.star.position.set(
				target.x,
				target.y + STAR_HEIGHT + Math.sin(this.time * 2.5) * 0.06,
				target.z,
			);
		}
		this.publish(context, target);
	}

	private isDone(context: TutorialFrame): boolean {
		const { frame, feet, inventory } = context;
		switch (this.step) {
			case "move":
				if (this.last) {
					this.travelled += Math.hypot(
						feet.x - this.last.x,
						feet.z - this.last.z,
					);
				}
				this.last = { ...feet };
				return this.travelled >= MOVE_DISTANCE;
			case "lantern":
				return frame.pressed.has("lantern");
			case "door":
				return this.doorUsed;
			case "loot":
				return this.missingMaterials(inventory).length === 0;
			case "grimoire":
				if (!this.loaded.grimoire.isOpen) {
					this.readSince = 0;
					return false;
				}
				this.readSince ||= performance.now();
				return performance.now() - this.readSince >= GRIMOIRE_READ_MS;
			case "altar":
				return (
					inventory !== null &&
					Object.values(inventory.objects).some((count) => count > 0)
				);
			case "hold":
				return context.heldObject === this.object;
			case "hide":
				this.wasHidden ||= context.hidden;
				return this.wasHidden && !context.hidden;
			case "shout":
				return frame.pressed.has("shout");
			case "capture":
				return this.captured;
			case "end":
				return false;
		}
	}

	private get object(): OccultId | null {
		return this.init.roster[0]?.occult ?? null;
	}

	private recipe(): [MaterialId, number][] {
		return this.object
			? (Object.entries(OCCULT_RECIPES[this.object]) as [MaterialId, number][])
			: [];
	}

	private missingMaterials(inventory: PlayerInventory | null): MaterialId[] {
		return this.recipe()
			.filter(([id, count]) => (inventory?.materials[id] ?? 0) < count)
			.map(([id]) => id);
	}

	private nearest(feet: Vec3, points: Vec3[]): Vec3 | null {
		const distance = (point: Vec3) =>
			Math.hypot(point.x - feet.x, point.z - feet.z);
		const sameFloor = points.filter(
			(point) => Math.abs(point.y - feet.y) < SAME_FLOOR,
		);
		const pool = sameFloor.length > 0 ? sameFloor : points;
		return (
			[...pool].sort(
				(first, second) => distance(first) - distance(second),
			)[0] ?? null
		);
	}

	private objectName(): string {
		return this.object ? currentMessages().grimoire.objects[this.object] : "";
	}

	private targetFor(feet: Vec3): Vec3 | null {
		const { layout, pickups, doors, anomalies } = this.loaded;
		switch (this.step) {
			case "door":
				return this.nearest(
					feet,
					[...doors.doors.values()].map((door) => ({
						x: door.geometry.center.x,
						y: door.geometry.floorY,
						z: door.geometry.center.z,
					})),
				);
			case "loot": {
				const missing = this.missingMaterials(this.inventory);
				return this.nearest(
					feet,
					layout.pickups.filter(
						(pickup) =>
							pickups.isAvailable(pickup.id) &&
							missing.includes(pickup.material),
					),
				);
			}
			case "altar":
				return this.nearest(feet, layout.altars);
			case "hide":
				return this.nearest(
					feet,
					layout.hideSpots.map((spot) => ({
						x: spot.entry.x,
						y: spot.interior.y,
						z: spot.entry.z,
					})),
				);
			case "capture": {
				const center = anomalies.infos()[0]?.center;
				return center ? { x: center.x, y: center.y - 1, z: center.z } : null;
			}
			default:
				return null;
		}
	}

	private text(): { title: string; body: string } {
		const keys = settingsStore.get().keys;
		const label = (action: keyof typeof keys) => keyLabel(keys[action]);
		const steps = currentMessages().game.tutorial.steps;
		switch (this.step) {
			case "move":
				return steps.move(
					[
						label("moveForward"),
						label("moveLeft"),
						label("moveBackward"),
						label("moveRight"),
					].join(" "),
					label("sprint"),
					label("crouch"),
				);
			case "lantern":
				return steps.lantern(label("lantern"));
			case "door":
				return steps.door(label("interact"));
			case "loot":
				return steps.loot(
					label("interact"),
					this.recipe()
						.map(
							([id, count]) =>
								`${Math.min(count, this.inventory?.materials[id] ?? 0)}/${count} ${currentMessages().grimoire.materials[id]}`,
						)
						.join(", "),
				);
			case "grimoire":
				return steps.grimoire(label("grimoire"));
			case "altar":
				return steps.altar(label("interact"), this.objectName());
			case "hold":
				return steps.hold(this.objectName());
			case "hide":
				return steps.hide(label("interact"));
			case "shout":
				return steps.shout(label("shout"));
			case "capture":
				return steps.capture(
					this.init.roster[0]?.formula.join(" · ") ?? "",
					label("lantern"),
				);
			case "end":
				return steps.end(label("push"), label("map"));
		}
	}

	private checks(context: TutorialFrame): TutorialCheck[] {
		if (this.step !== "capture") {
			return [];
		}
		const labels = currentMessages().game.tutorial.checks;
		const center = this.loaded.anomalies.infos()[0]?.center;
		const range = SPECIES.murmure.capture.maxRange;
		const distance = center
			? Math.hypot(
					center.x - context.feet.x,
					center.y - context.feet.y - EYE_HEIGHT_STANDING,
					center.z - context.feet.z,
				)
			: Infinity;
		const level = micManager.measure();
		if (level >= VOICE_HEARD_LEVEL) {
			this.voiceHeardAt = performance.now();
		}
		return [
			{
				label: labels.lantern,
				ok:
					context.lanternOpen ===
					(SPECIES.murmure.capture.lantern !== CAPTURE_LANTERN),
			},
			{ label: labels.range(range), ok: distance <= range },
			{
				label: labels.object,
				ok: context.heldObject === this.object,
			},
			{
				label: labels.voice,
				ok: performance.now() - this.voiceHeardAt < VOICE_MEMORY_MS,
			},
		];
	}

	private publish(context: TutorialFrame, target: Vec3 | null): void {
		let arrow: number | null = null;
		let distance: number | null = null;
		if (target) {
			const dx = target.x - context.feet.x;
			const dz = target.z - context.feet.z;
			distance = Math.round(Math.hypot(dx, dz));
			arrow =
				Math.round(
					(wrapAngle(Math.atan2(-dx, -dz) - context.yaw) * 180) / Math.PI / 5,
				) * 5;
		}
		const checks = this.checks(context);
		const key = `${this.index}:${arrow}:${distance}:${this.finished}:${JSON.stringify(context.inventory?.materials)}:${checks.map((check) => check.ok).join()}`;
		if (key === this.lastPublished) {
			return;
		}
		this.lastPublished = key;
		hudStore.set({
			tutorial: {
				index: this.index,
				total: TUTORIAL_STEPS.length,
				arrow,
				distance,
				finished: this.finished,
				checks,
				...this.text(),
			},
		});
	}

	dispose(): void {
		window.removeEventListener("keydown", this.onKeyDown, true);
		this.loaded.scene.remove(this.star);
		this.star.material.dispose();
		this.starTexture.dispose();
		hudStore.set({ tutorial: null });
	}
}
