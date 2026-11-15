import {
	CAPTURE_MAX_RANGE,
	EYE_HEIGHT_STANDING,
	type MaterialId,
	OCCULT_RECIPES,
	type OccultId,
	PACT_HEALTH_COST,
	RELIQUARY_FRAGMENTS,
	SANCTUARY_DURATION_MS,
	SHOUT_RANGE,
	type StakeKind,
	VALVE_COOLDOWN_MS,
	VALVE_HEAL_RADIUS,
	VALVE_JET_DURATION_MS,
} from "@shared/config/index";
import { SPECIES_LIST } from "@shared/config/species";
import { type Vec3, wrapAngle } from "@shared/math";
import {
	type GameEvent,
	type MatchInit,
	PLAYER_FLAG,
	type PlayerInventory,
} from "@shared/protocol/game";
import {
	TUTORIAL_DUMMY_CAST_MS,
	TUTORIAL_DUMMY_ID,
	TUTORIAL_STEALTH_NEAR,
	TUTORIAL_WOUNDED_HEALTH,
	type TutorialStage,
} from "@shared/tutorial";
import * as THREE from "three";
import { keyLabel } from "../../../config/controls";
import { currentMessages } from "../../../i18n";
import type { ActionId } from "../../../types/settings";
import { playUiClick } from "../../audio/uiSounds";
import type { FrameInput } from "../../engine/input/InputManager";
import {
	hudStore,
	pushFeedback,
	type TutorialCheck,
	type TutorialChoice,
} from "../../hud/hudStore";
import { settingsStore } from "../../settings/settingsStore";
import { micManager } from "../../voice/micManager";
import type { LoadedWorld } from "./SessionLoader";

type ChapterId = "movement" | "items" | "interactions" | "capture" | "bonus";

type StepId =
	| "move"
	| "run"
	| "stealth"
	| "map"
	| "lantern"
	| "fragments"
	| "altar"
	| "water"
	| "push"
	| "shout"
	| "goal"
	| "capture"
	| "fork"
	| "pact"
	| "sanctuary"
	| "reliquary"
	| "walkie"
	| "camera"
	| "end";

interface StepSpec {
	id: StepId;
	chapter: ChapterId | null;
	stage: TutorialStage;
}

const STEPS: readonly StepSpec[] = [
	{ id: "move", chapter: "movement", stage: "free" },
	{ id: "run", chapter: "movement", stage: "free" },
	{ id: "stealth", chapter: "movement", stage: "stealth" },
	{ id: "map", chapter: "items", stage: "free" },
	{ id: "lantern", chapter: "items", stage: "free" },
	{ id: "fragments", chapter: "items", stage: "free" },
	{ id: "altar", chapter: "items", stage: "free" },
	{ id: "water", chapter: "interactions", stage: "wound" },
	{ id: "push", chapter: "interactions", stage: "push" },
	{ id: "shout", chapter: "interactions", stage: "shout" },
	{ id: "goal", chapter: "capture", stage: "capture" },
	{ id: "capture", chapter: "capture", stage: "capture" },
	{ id: "fork", chapter: null, stage: "free" },
	{ id: "pact", chapter: "bonus", stage: "pact" },
	{ id: "sanctuary", chapter: "bonus", stage: "sanctuary" },
	{ id: "reliquary", chapter: "bonus", stage: "reliquary" },
	{ id: "walkie", chapter: "bonus", stage: "walkie" },
	{ id: "camera", chapter: "bonus", stage: "camera" },
	{ id: "end", chapter: null, stage: "free" },
];

const CHAPTERS: readonly ChapterId[] = [
	"movement",
	"items",
	"interactions",
	"capture",
	"bonus",
];

const TELEPORT_STAGES: ReadonlySet<TutorialStage> = new Set([
	"stealth",
	"pact",
	"sanctuary",
	"reliquary",
	"walkie",
	"camera",
]);

const MOVE_ACTIONS = [
	"moveForward",
	"moveBackward",
	"moveLeft",
	"moveRight",
] as const;

const STEP_DONE_DELAY_MS = 1400;
const WALK_DISTANCE = 6;
const SPRINT_PRACTICE_S = 1.5;
const SNEAK_PRACTICE_S = 2.5;
const RADIO_PRACTICE_S = 1;
const QUIET_AFTER_HEARD_MS = 900;
const HEARD_BADGE_MS = 1200;
const CAST_RESULT_MS = 2600;
const GRIMOIRE_READ_MS = 2500;
const HEAL_TO_PASS = 16;
const SANCTUARY_GAIN = 20;
const SAME_FLOOR = 2;
const STAR_SCALE = 0.075;
const STAR_HEIGHT = 1.6;
const STAKE_STAR_HEIGHT = 2.3;
const BADGE_SCALE = 0.066;
const EAR_BADGE_HEIGHT = EYE_HEIGHT_STANDING + 0.25;
const SPELL_BADGE_HEIGHT = 1.35;
const VOICE_HEARD_LEVEL = 0.08;
const VOICE_MEMORY_MS = 2500;
const TOP_POINTS = Math.max(...SPECIES_LIST.map((species) => species.points));

const BADGE_DANGER = "#ff6a55";
const BADGE_CALM = "#8fd36a";
const BADGE_CAST = "#c39bff";
const BADGE_FONT = '700 46px "Barlow Condensed", "Arial Narrow", sans-serif';

export interface TutorialFrame {
	frame: FrameInput;
	feet: Vec3;
	yaw: number;
	grounded: boolean;
	inventory: PlayerInventory | null;
	heldObject: OccultId | null;
	lanternOpen: boolean;
	mapOpen: boolean;
	grimoireOpen: boolean;
	cameraRaised: boolean;
	radioOn: boolean;
	photos: number;
	health: number;
	serverNow: number;
	dt: number;
}

export interface TutorialActions {
	stage: (stage: TutorialStage) => void;
}

interface StepMemo {
	startedAt: number;
	travelled: number;
	last: Vec3 | null;
	sprintTime: number;
	jumped: boolean;
	heardStanding: boolean;
	sneakTime: number;
	opened: boolean;
	woundSeen: boolean;
	readSince: number;
	radioTime: number;
	photosAtStart: number | null;
	healthAtStart: number | null;
}

interface Evaluation {
	checks: TutorialCheck[];
	done: boolean;
}

interface Target {
	point: Vec3;
	lift: number;
}

function freshMemo(): StepMemo {
	return {
		startedAt: performance.now(),
		travelled: 0,
		last: null,
		sprintTime: 0,
		jumped: false,
		heardStanding: false,
		sneakTime: 0,
		opened: false,
		woundSeen: false,
		readSince: 0,
		radioTime: 0,
		photosAtStart: null,
		healthAtStart: null,
	};
}

function percent(value: number, target: number): number {
	return Math.min(100, Math.round((value / target) * 100));
}

function starCanvas(): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	context.beginPath();
	for (let index = 0; index < 10; index += 1) {
		const radius = index % 2 === 0 ? 58 : 23;
		const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
		context.lineTo(
			64 + Math.cos(angle) * radius,
			64 + Math.sin(angle) * radius,
		);
	}
	context.closePath();
	context.fillStyle = "#ffe07a";
	context.strokeStyle = "#5a3c08";
	context.lineWidth = 5;
	context.fill();
	context.stroke();
	return canvas;
}

function overlaySprite(texture: THREE.Texture): THREE.Sprite {
	const sprite = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			depthTest: false,
			depthWrite: false,
			fog: false,
			sizeAttenuation: false,
		}),
	);
	sprite.renderOrder = 10;
	sprite.visible = false;
	return sprite;
}

class WorldBadge {
	readonly sprite: THREE.Sprite;
	private readonly canvas = document.createElement("canvas");
	private readonly texture: THREE.CanvasTexture;
	private drawn = "";

	constructor() {
		this.canvas.width = 512;
		this.canvas.height = 112;
		this.texture = new THREE.CanvasTexture(this.canvas);
		this.texture.colorSpace = THREE.SRGBColorSpace;
		this.sprite = overlaySprite(this.texture);
		this.sprite.scale.set(
			(BADGE_SCALE * this.canvas.width) / this.canvas.height,
			BADGE_SCALE,
			1,
		);
		this.sprite.renderOrder = 11;
	}

	show(
		position: THREE.Vector3,
		text: string,
		color: string,
		fill: number | null,
	) {
		this.sprite.position.copy(position);
		this.sprite.visible = true;
		const key = `${text}|${color}|${fill === null ? "" : Math.round(fill * 40)}`;
		if (key === this.drawn) {
			return;
		}
		this.drawn = key;
		const context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
		const { width, height } = this.canvas;
		context.clearRect(0, 0, width, height);
		context.font = BADGE_FONT;
		const textWidth = Math.min(
			width - 24,
			context.measureText(text).width + 56,
		);
		const left = (width - textWidth) / 2;
		context.fillStyle = "rgba(10, 12, 10, 0.86)";
		context.strokeStyle = color;
		context.lineWidth = 5;
		context.beginPath();
		context.roundRect(left, 8, textWidth, height - 16, 22);
		context.fill();
		context.stroke();
		if (fill !== null) {
			context.fillStyle = color;
			context.globalAlpha = 0.35;
			context.beginPath();
			context.roundRect(
				left + 6,
				14,
				Math.max(0, (textWidth - 12) * Math.min(1, fill)),
				height - 28,
				16,
			);
			context.fill();
			context.globalAlpha = 1;
		}
		context.fillStyle = color;
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.fillText(text, width / 2, height / 2 + 2, textWidth - 28);
		this.texture.needsUpdate = true;
	}

	hide(): void {
		this.sprite.visible = false;
	}

	dispose(): void {
		this.sprite.material.dispose();
		this.texture.dispose();
	}
}

export class TutorialController {
	private index = 0;
	private entered = -1;
	private sentStage: TutorialStage | null = null;
	private memo = freshMemo();
	private completedAt: number | null = null;
	private skip = false;
	private finished = false;
	private time = 0;
	private lastPublished = "";
	private crouchHeld = false;
	private heardAt = -Infinity;
	private pushedAt = -Infinity;
	private interruptedAt = -Infinity;
	private capturedAt = -Infinity;
	private craftedAt = -Infinity;
	private voiceHeardAt = -Infinity;
	private readonly stakeAt: Record<StakeKind, number> = {
		sanctuary: -Infinity,
		reliquary: -Infinity,
		pact: -Infinity,
	};
	private castStartedAt: number | null = null;
	private castEndedAt = -Infinity;
	private castOutcome: "interrupted" | "completed" | null = null;
	private readonly star: THREE.Sprite;
	private readonly starTexture: THREE.CanvasTexture;
	private readonly ear = new WorldBadge();
	private readonly spell = new WorldBadge();
	private readonly listener = (event: GameEvent) => this.onEvent(event);

	constructor(
		private readonly init: MatchInit,
		private readonly loaded: LoadedWorld,
		private readonly actions: TutorialActions,
	) {
		this.starTexture = new THREE.CanvasTexture(starCanvas());
		this.starTexture.colorSpace = THREE.SRGBColorSpace;
		this.star = overlaySprite(this.starTexture);
		this.star.scale.setScalar(STAR_SCALE);
		loaded.scene.add(this.star, this.ear.sprite, this.spell.sprite);
		loaded.state.listeners.add(this.listener);
		window.addEventListener("keydown", this.onKeyDown, true);
	}

	private readonly onKeyDown = (event: KeyboardEvent) => {
		if (event.code === "Enter" && !event.repeat) {
			this.skip = true;
		}
	};

	private get spec(): StepSpec {
		return STEPS[this.index];
	}

	private get step(): StepId {
		return this.spec.id;
	}

	private get object(): OccultId | null {
		return this.init.roster[0]?.occult ?? null;
	}

	private get selfId(): string {
		return this.loaded.state.selfId;
	}

	private onEvent(event: GameEvent): void {
		const now = performance.now();
		switch (event.type) {
			case "heard":
				if (event.playerId === this.selfId) {
					this.heardAt = now;
					this.memo.sneakTime = 0;
					if (!this.crouchHeld) {
						this.memo.heardStanding = true;
					}
				}
				break;
			case "push":
				if (
					event.fromId === this.selfId &&
					event.targetId === TUTORIAL_DUMMY_ID
				) {
					this.pushedAt = now;
				}
				break;
			case "castInterrupted":
				if (event.playerId === TUTORIAL_DUMMY_ID) {
					this.castOutcome = "interrupted";
					this.castEndedAt = now;
					this.castStartedAt = null;
					if (event.byId === this.selfId && event.cause !== "push") {
						this.interruptedAt = now;
					}
				}
				break;
			case "capture":
				if (event.playerId === this.selfId) {
					this.capturedAt = now;
				}
				break;
			case "craft":
				if (event.playerId === this.selfId) {
					this.craftedAt = now;
				}
				break;
			case "stake":
				if (event.playerId === this.selfId) {
					this.stakeAt[event.stake] = now;
				}
				break;
			default:
				break;
		}
	}

	update(context: TutorialFrame): void {
		this.time += context.dt;
		this.crouchHeld = context.frame.held.has("crouch");
		let checks: TutorialCheck[] = [];
		if (!this.finished) {
			this.enterStep();
			this.trackDummy();
			const step = this.index;
			const evaluation = this.evaluate(context);
			this.advance(context, evaluation);
			if (step !== this.index) {
				this.enterStep();
			}
			checks =
				step !== this.index || this.finished
					? []
					: this.completedAt === null
						? evaluation.checks
						: evaluation.checks.map((check) => ({ ...check, ok: true }));
		}
		const target = this.finished
			? null
			: this.target(context.feet, context.inventory);
		this.star.visible = target !== null;
		if (target) {
			this.star.position.set(
				target.point.x,
				target.point.y + target.lift + Math.sin(this.time * 2.5) * 0.06,
				target.point.z,
			);
		}
		this.updateBadges();
		this.publish(context, target?.point ?? null, checks);
	}

	private enterStep(): void {
		if (this.entered === this.index) {
			return;
		}
		this.entered = this.index;
		this.memo = freshMemo();
		const stage = this.spec.stage;
		if (stage !== this.sentStage) {
			this.sentStage = stage;
			this.actions.stage(stage);
			if (TELEPORT_STAGES.has(stage)) {
				pushFeedback(currentMessages().game.tutorial.teleported, "info");
			}
		}
	}

	private advance(context: TutorialFrame, { done }: Evaluation): void {
		const skip = this.skip;
		this.skip = false;
		if (this.step === "fork") {
			if (skip) {
				this.finish();
			} else if (context.frame.pressed.has("interact")) {
				playUiClick("confirm");
				this.next();
			}
			return;
		}
		if (this.step === "end") {
			if (skip) {
				this.finish();
			}
			return;
		}
		if (skip) {
			this.next();
			return;
		}
		const now = performance.now();
		if (this.completedAt === null) {
			if (done) {
				this.completedAt = now;
				pushFeedback(currentMessages().game.tutorial.stepDone, "success");
				playUiClick("confirm");
			}
			return;
		}
		const following = STEPS[this.index + 1];
		const teleports =
			following !== undefined &&
			following.stage !== this.spec.stage &&
			TELEPORT_STAGES.has(following.stage);
		if (
			now - this.completedAt >= STEP_DONE_DELAY_MS &&
			(!teleports || context.grounded)
		) {
			this.next();
		}
	}

	private next(): void {
		this.completedAt = null;
		this.index = Math.min(STEPS.length - 1, this.index + 1);
	}

	private finish(): void {
		this.finished = true;
		playUiClick("confirm");
	}

	private trackDummy(): void {
		const flags =
			this.loaded.state.players.get(TUTORIAL_DUMMY_ID)?.latest?.flags ?? 0;
		const casting = (flags & PLAYER_FLAG.casting) !== 0;
		const now = performance.now();
		if (casting && this.castStartedAt === null) {
			this.castStartedAt = now;
			this.castOutcome = null;
			return;
		}
		if (!casting && this.castStartedAt !== null) {
			const lasted = now - this.castStartedAt;
			this.castStartedAt = null;
			this.castEndedAt = now;
			if (this.castOutcome === null) {
				this.castOutcome =
					lasted >= TUTORIAL_DUMMY_CAST_MS * 0.85 ? "completed" : "interrupted";
				if (this.castOutcome === "completed" && this.step === "shout") {
					pushFeedback(
						currentMessages().game.tutorial.castCompleted,
						"warning",
					);
				}
			}
		}
	}

	private recipe(): [MaterialId, number][] {
		return this.object
			? (Object.entries(OCCULT_RECIPES[this.object]) as [MaterialId, number][])
			: [];
	}

	private crafted(inventory: PlayerInventory | null): boolean {
		return (
			this.craftedAt > -Infinity ||
			(this.object !== null && (inventory?.objects[this.object] ?? 0) > 0)
		);
	}

	private missingMaterials(inventory: PlayerInventory | null): MaterialId[] {
		return this.recipe()
			.filter(([id, count]) => (inventory?.materials[id] ?? 0) < count)
			.map(([id]) => id);
	}

	private monsterDistance(feet: Vec3): number {
		const info = this.loaded.anomalies.info(0);
		return info
			? Math.hypot(info.position.x - feet.x, info.position.z - feet.z)
			: Infinity;
	}

	private moving(frame: FrameInput): boolean {
		return MOVE_ACTIONS.some((action) => frame.held.has(action));
	}

	private evaluate(context: TutorialFrame): Evaluation {
		const labels = currentMessages().game.tutorial.checks;
		const { frame, feet, dt, inventory } = context;
		const memo = this.memo;
		const keys = settingsStore.get().keys;
		const label = (action: ActionId) => keyLabel(keys[action]);
		const all = (checks: TutorialCheck[]): Evaluation => ({
			checks,
			done: checks.every((check) => check.ok),
		});
		switch (this.step) {
			case "move": {
				if (memo.last) {
					memo.travelled += Math.hypot(
						feet.x - memo.last.x,
						feet.z - memo.last.z,
					);
				}
				memo.last = { ...feet };
				return all([
					{
						label: labels.walk(percent(memo.travelled, WALK_DISTANCE)),
						ok: memo.travelled >= WALK_DISTANCE,
					},
				]);
			}
			case "run":
				if (frame.held.has("sprint") && this.moving(frame)) {
					memo.sprintTime += dt;
				}
				memo.jumped ||= frame.pressed.has("jump");
				return all([
					{
						label: labels.sprint(
							label("sprint"),
							percent(memo.sprintTime, SPRINT_PRACTICE_S),
						),
						ok: memo.sprintTime >= SPRINT_PRACTICE_S,
					},
					{ label: labels.jump(label("jump")), ok: memo.jumped },
				]);
			case "stealth": {
				const quiet = performance.now() - this.heardAt > QUIET_AFTER_HEARD_MS;
				if (
					this.crouchHeld &&
					this.moving(frame) &&
					quiet &&
					this.monsterDistance(feet) <= TUTORIAL_STEALTH_NEAR
				) {
					memo.sneakTime += dt;
				}
				return all([
					{ label: labels.heardStanding, ok: memo.heardStanding },
					{
						label: labels.sneak(
							label("crouch"),
							TUTORIAL_STEALTH_NEAR,
							percent(memo.sneakTime, SNEAK_PRACTICE_S),
						),
						ok: memo.sneakTime >= SNEAK_PRACTICE_S,
					},
				]);
			}
			case "map":
				memo.opened ||= context.mapOpen;
				return all([
					{ label: labels.mapOpened, ok: memo.opened },
					{ label: labels.mapClosed, ok: memo.opened && !context.mapOpen },
				]);
			case "lantern":
				memo.opened ||= context.lanternOpen;
				return all([
					{ label: labels.lanternOpened, ok: memo.opened },
					{
						label: labels.lanternClosed,
						ok: memo.opened && !context.lanternOpen,
					},
				]);
			case "fragments": {
				const crafted = this.crafted(inventory);
				const names = currentMessages().grimoire.materials;
				return all(
					this.recipe().map(([id, count]) => {
						const have = Math.min(count, inventory?.materials[id] ?? 0);
						return {
							label: labels.material(names[id], crafted ? count : have, count),
							ok: crafted || have >= count,
						};
					}),
				);
			}
			case "altar":
				return all([
					{
						label: labels.crafted(this.objectName()),
						ok: this.crafted(inventory),
					},
					{
						label: labels.held(this.objectName()),
						ok: this.object !== null && context.heldObject === this.object,
					},
				]);
			case "water":
				return this.waterChecks(context);
			case "push":
				return all([
					{
						label: labels.pushed(label("push")),
						ok: this.pushedAt >= memo.startedAt,
					},
				]);
			case "shout": {
				const broken = this.interruptedAt >= memo.startedAt;
				const dummy = this.loaded.remotePlayers.positionOf(TUTORIAL_DUMMY_ID);
				const near =
					dummy !== null &&
					Math.hypot(dummy.x - feet.x, dummy.z - feet.z) <= SHOUT_RANGE;
				return {
					checks: [
						{ label: labels.shoutRange(SHOUT_RANGE), ok: broken || near },
						{ label: labels.interrupted(label("shout")), ok: broken },
					],
					done: broken,
				};
			}
			case "goal":
				if (context.grimoireOpen) {
					memo.readSince ||= performance.now();
				} else {
					memo.readSince = 0;
				}
				return all([
					{
						label: labels.grimoire(label("grimoire")),
						ok:
							memo.readSince > 0 &&
							performance.now() - memo.readSince >= GRIMOIRE_READ_MS,
					},
				]);
			case "capture":
				return this.captureChecks(context);
			case "pact":
				return all([
					{ label: labels.pact, ok: this.stakeAt.pact >= memo.startedAt },
				]);
			case "sanctuary": {
				const lit = this.stakeAt.sanctuary >= memo.startedAt;
				const health = Math.round(context.health);
				if (lit) {
					memo.healthAtStart ??= health;
				}
				const gained = lit ? health - (memo.healthAtStart ?? health) : 0;
				return all([
					{ label: labels.sanctuary, ok: lit },
					{
						label: labels.regained(
							Math.max(0, Math.min(gained, SANCTUARY_GAIN)),
							SANCTUARY_GAIN,
						),
						ok: lit && (gained >= SANCTUARY_GAIN || health >= 100),
					},
				]);
			}
			case "reliquary":
				return all([
					{
						label: labels.reliquary,
						ok: this.stakeAt.reliquary >= memo.startedAt,
					},
				]);
			case "walkie": {
				const taken = this.loaded.state.selfHasWalkie;
				if (taken && context.radioOn) {
					memo.radioTime += dt;
				}
				return all([
					{ label: labels.walkieTaken(label("interact")), ok: taken },
					{
						label: labels.radio(
							label("radio"),
							percent(memo.radioTime, RADIO_PRACTICE_S),
						),
						ok: memo.radioTime >= RADIO_PRACTICE_S,
					},
				]);
			}
			case "camera": {
				const taken = this.loaded.state.selfHasCamera;
				memo.photosAtStart ??= context.photos;
				memo.opened ||= taken && context.cameraRaised;
				return all([
					{ label: labels.cameraTaken(label("interact")), ok: taken },
					{ label: labels.cameraRaised(label("camera")), ok: memo.opened },
					{
						label: labels.photo(label("photo")),
						ok: context.photos > memo.photosAtStart,
					},
				]);
			}
			default:
				return { checks: [], done: false };
		}
	}

	private waterChecks({ feet, serverNow, health }: TutorialFrame): Evaluation {
		const { layout, state } = this.loaded;
		const labels = currentMessages().game.tutorial.checks;
		const memo = this.memo;
		memo.woundSeen ||= health <= TUTORIAL_WOUNDED_HEALTH;
		const flowing = layout.valves.filter(
			(valve) => (state.valves.get(valve.id)?.activeUntil ?? 0) > serverNow,
		);
		const target = TUTORIAL_WOUNDED_HEALTH + HEAL_TO_PASS;
		const healed = memo.woundSeen && health >= target;
		const checks = [
			{ label: labels.valveOpen, ok: flowing.length > 0 || healed },
			{
				label: labels.inJet,
				ok:
					healed ||
					flowing.some(
						(valve) =>
							Math.hypot(feet.x - valve.jet.x, feet.z - valve.jet.z) <=
								VALVE_HEAL_RADIUS &&
							Math.abs(feet.y - valve.floorY) < SAME_FLOOR,
					),
			},
			{
				label: labels.healed(Math.min(Math.round(health), target), target),
				ok: healed,
			},
		];
		return { checks, done: healed };
	}

	private captureChecks(context: TutorialFrame): Evaluation {
		const labels = currentMessages().game.tutorial.checks;
		const center = this.loaded.anomalies.info(0)?.center;
		const distance = center
			? Math.hypot(
					center.x - context.feet.x,
					center.y - context.feet.y - EYE_HEIGHT_STANDING,
					center.z - context.feet.z,
				)
			: Infinity;
		if (micManager.measure() >= VOICE_HEARD_LEVEL) {
			this.voiceHeardAt = performance.now();
		}
		return {
			checks: [
				{
					label: labels.range(CAPTURE_MAX_RANGE),
					ok: distance <= CAPTURE_MAX_RANGE,
				},
				{
					label: labels.object(this.objectName()),
					ok: this.object !== null && context.heldObject === this.object,
				},
				{
					label: labels.voice,
					ok: performance.now() - this.voiceHeardAt < VOICE_MEMORY_MS,
				},
			],
			done: this.capturedAt > -Infinity,
		};
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

	private target(feet: Vec3, inventory: PlayerInventory | null): Target | null {
		const { layout, pickups, anomalies, state, walkies, cameras } = this.loaded;
		const at = (point: Vec3 | null, lift = STAR_HEIGHT): Target | null =>
			point ? { point, lift } : null;
		switch (this.step) {
			case "fragments": {
				const missing = this.missingMaterials(inventory);
				return at(
					this.nearest(
						feet,
						layout.pickups.filter(
							(pickup) =>
								pickups.isAvailable(pickup.id) &&
								missing.includes(pickup.material),
						),
					),
				);
			}
			case "altar":
				return this.crafted(inventory)
					? null
					: at(this.nearest(feet, layout.altars));
			case "water":
				return at(
					this.nearest(
						feet,
						layout.valves.map((valve) => ({
							x: valve.jet.x,
							y: valve.floorY,
							z: valve.jet.z,
						})),
					),
				);
			case "capture": {
				const center = anomalies.info(0)?.center;
				return center
					? at({ x: center.x, y: center.y - 1, z: center.z })
					: null;
			}
			case "pact":
			case "sanctuary":
			case "reliquary": {
				const kind = this.step;
				if (this.stakeAt[kind] >= this.memo.startedAt) {
					return null;
				}
				const stake = layout.stakes.find((entry) => entry.kind === kind);
				return stake ? at(stake, STAKE_STAR_HEIGHT) : null;
			}
			case "walkie":
				return state.selfHasWalkie
					? null
					: at(
							this.nearest(
								feet,
								layout.walkies
									.slice(0, this.init.walkieTotal)
									.filter((spot) => walkies.isAvailable(spot.id)),
							),
						);
			case "camera":
				return state.selfHasCamera
					? null
					: at(
							this.nearest(
								feet,
								layout.cameras
									.slice(0, this.init.cameraTotal)
									.filter((spot) => cameras.isAvailable(spot.id)),
							),
						);
			default:
				return null;
		}
	}

	private updateBadges(): void {
		const labels = currentMessages().game.tutorial.badges;
		const now = performance.now();
		const info =
			!this.finished && this.step === "stealth"
				? this.loaded.anomalies.info(0)
				: null;
		if (info) {
			const heard = now - this.heardAt < HEARD_BADGE_MS;
			this.ear.show(
				new THREE.Vector3(
					info.position.x,
					info.position.y + EAR_BADGE_HEIGHT,
					info.position.z,
				),
				heard ? labels.heard : labels.quiet,
				heard ? BADGE_DANGER : BADGE_CALM,
				null,
			);
		} else {
			this.ear.hide();
		}
		const anchor =
			!this.finished && this.step === "shout"
				? this.loaded.remotePlayers.positionOf(TUTORIAL_DUMMY_ID)
				: null;
		if (!anchor) {
			this.spell.hide();
			return;
		}
		const position = anchor.clone();
		position.y += SPELL_BADGE_HEIGHT;
		if (this.castStartedAt !== null) {
			this.spell.show(
				position,
				labels.casting,
				BADGE_CAST,
				(now - this.castStartedAt) / TUTORIAL_DUMMY_CAST_MS,
			);
		} else if (now - this.castEndedAt < CAST_RESULT_MS && this.castOutcome) {
			const broken = this.castOutcome === "interrupted";
			this.spell.show(
				position,
				broken ? labels.interrupted : labels.completed,
				broken ? BADGE_CALM : BADGE_DANGER,
				null,
			);
		} else {
			this.spell.hide();
		}
	}

	private objectName(): string {
		return this.object ? currentMessages().grimoire.objects[this.object] : "";
	}

	private speciesName(): string {
		const species = this.init.roster[0]?.species;
		return species ? currentMessages().grimoire.species[species].name : "";
	}

	private speciesPoints(): number {
		const species = this.init.roster[0]?.species;
		return SPECIES_LIST.find((entry) => entry.id === species)?.points ?? 0;
	}

	private text(): { title: string; body: string } {
		const keys = settingsStore.get().keys;
		const label = (action: ActionId) => keyLabel(keys[action]);
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
				);
			case "run":
				return steps.run(label("sprint"), label("jump"));
			case "stealth":
				return steps.stealth(label("crouch"), this.speciesName());
			case "map":
				return steps.map(label("map"));
			case "lantern":
				return steps.lantern(label("lantern"));
			case "fragments":
				return steps.fragments(label("interact"), this.objectName());
			case "altar":
				return steps.altar(label("interact"), this.objectName());
			case "water":
				return steps.water(
					label("interact"),
					VALVE_JET_DURATION_MS / 1000,
					VALVE_COOLDOWN_MS / 1000,
				);
			case "push":
				return steps.push(label("push"));
			case "shout":
				return steps.shout(label("shout"), this.speciesName());
			case "goal":
				return steps.goal(TOP_POINTS, label("grimoire"), this.speciesName());
			case "capture":
				return steps.capture(
					this.speciesName(),
					CAPTURE_MAX_RANGE,
					this.init.roster[0]?.formula.join(" · ") ?? "",
				);
			case "fork":
				return steps.fork(this.speciesPoints());
			case "pact":
				return steps.pact(label("interact"), PACT_HEALTH_COST);
			case "sanctuary":
				return steps.sanctuary(label("interact"), SANCTUARY_DURATION_MS / 1000);
			case "reliquary":
				return steps.reliquary(label("interact"), RELIQUARY_FRAGMENTS);
			case "walkie":
				return steps.walkie(label("interact"), label("radio"));
			case "camera":
				return steps.camera(
					label("interact"),
					label("camera"),
					label("aim"),
					label("photo"),
				);
			case "end":
				return steps.end();
		}
	}

	private choices(): TutorialChoice[] {
		const labels = currentMessages().game.tutorial.choices;
		const enter = keyLabel("Enter");
		if (this.step === "fork") {
			return [
				{ key: enter, label: labels.quit },
				{
					key: keyLabel(settingsStore.get().keys.interact),
					label: labels.more,
				},
			];
		}
		if (this.step === "end") {
			return [{ key: enter, label: labels.quit }];
		}
		return [];
	}

	private header(): {
		chapter: string;
		chapterIndex: number;
		step: number;
		steps: number;
	} {
		const messages = currentMessages().game.tutorial;
		const chapter = this.spec.chapter;
		if (chapter === null) {
			const fork = this.step === "fork";
			return {
				chapter: fork ? messages.forkHeader : messages.endHeader,
				chapterIndex: fork ? CHAPTERS.indexOf("bonus") : CHAPTERS.length,
				step: 0,
				steps: 0,
			};
		}
		const siblings = STEPS.filter((entry) => entry.chapter === chapter);
		return {
			chapter: messages.chapters[chapter],
			chapterIndex: CHAPTERS.indexOf(chapter),
			step: siblings.findIndex((entry) => entry.id === this.step) + 1,
			steps: siblings.length,
		};
	}

	private publish(
		context: TutorialFrame,
		target: Vec3 | null,
		checks: TutorialCheck[],
	): void {
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
		const choices = this.choices();
		const key = `${this.index}:${arrow}:${distance}:${this.finished}:${settingsStore.get().language}:${checks.map((check) => `${check.label}${check.ok}`).join()}`;
		if (key === this.lastPublished) {
			return;
		}
		this.lastPublished = key;
		const messages = currentMessages().game.tutorial;
		hudStore.set({
			tutorial: {
				...this.header(),
				chapterCount: CHAPTERS.length,
				...this.text(),
				checks,
				choices,
				arrow,
				distance,
				hint: choices.length > 0 ? "" : messages.skip(keyLabel("Enter")),
				finished: this.finished,
			},
		});
	}

	dispose(): void {
		window.removeEventListener("keydown", this.onKeyDown, true);
		this.loaded.state.listeners.delete(this.listener);
		this.loaded.scene.remove(this.star, this.ear.sprite, this.spell.sprite);
		this.star.material.dispose();
		this.starTexture.dispose();
		this.ear.dispose();
		this.spell.dispose();
		hudStore.set({ tutorial: null });
	}
}
