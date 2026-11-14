import { isGazingAt } from "@shared/anomalies/gaze";
import {
	ALTAR_INTERACT_RANGE,
	CAPTURE_VOICE_ACTIVITY_LEVEL,
	CLIENT_INTERPOLATION_DELAY_MS,
	CLIENT_STATE_INTERVAL_MS,
	EMOTE_COOLDOWN_MS,
	EMOTE_DURATION_MS,
	EMOTE_IDS,
	type EmoteId,
	ENERGY_MAX,
	GHOST_DOOR_COOLDOWN_MS,
	GHOST_KNOCK_COOLDOWN_MS,
	GORGON_GAZE_DECAY,
	GORGON_GAZE_LIMIT_MS,
	JUMP_ENERGY_COST,
	JUMP_MIN_ENERGY,
	LANTERN_LIGHT_INTENSITY,
	LANTERN_LIGHT_RANGE,
	LANTERN_MIN_ENERGY_TO_OPEN,
	LEVEL_HEIGHT,
	MATERIAL_IDS,
	MAX_PHOTOS_PER_MATCH,
	type MaterialId,
	OCCULT_IDS,
	OCCULT_RECIPES,
	type OccultId,
	PING_BURST,
	PING_BURST_WINDOW_MS,
	PING_COLORS,
	PING_COOLDOWN_MS,
	PING_HOLD_MS,
	PING_MAX_DISTANCE,
	PING_WHEEL,
	type PingKind,
	POSSESSED_CALL_RANGE,
	POSSESSED_POWER_COOLDOWN_MS,
	PUSH_COOLDOWN_MS,
	SHOUT_COOLDOWN_MS,
	SNAPSHOT_INTERVAL_TICKS,
	STRONG_PUSH_COOLDOWN_FACTOR,
	SLIME_SPEED_FACTOR,
	WATER_SPEED_FACTOR,
} from "@shared/config/index";
import { PlayerMarkerBlender } from "@shared/doubleDisguise";
import { type GhostBounds, ghostBounds } from "@shared/ghost";
import {
	BREW_DURATION_MS,
	BREW_GRAVITY_FACTOR,
	BREW_SPEED_FACTOR,
	type BrewEffect,
} from "@shared/manor/brews";
import { levelForHeight } from "@shared/manor/levels";
import { hasMutator } from "@shared/matchConfig";

import { type LiquidVolume, liquidAt } from "@shared/manor/liquids";
import type { Level } from "@shared/manor/types";
import { pullBackToSight } from "@shared/physics/lineOfSight";
import {
	type CastResult,
	type ForcedMove,
	type GameEvent,
	type Highlight,
	type MatchBegin,
	type MatchInit,
	PLAYER_FLAG,
	type PlayerInventory,
	type RoleInfo,
	type WorldSnapshot,
} from "@shared/protocol/game";
import { DEFAULT_LANTERN_TINT, LANTERN_TINT_COLORS } from "@shared/rewards";
import { TEAM_COLORS } from "@shared/teams";
import * as THREE from "three";
import { keyLabel } from "../../../config/controls";
import {
	CLOCK_WARNING_MS,
	HAZE_COLOR,
	HAZE_DENSITY,
	HAZE_FAR,
	HAZE_NEAR,
	LANTERN_COLOR,
	STAIR_PRELOAD_RANGE,
} from "../../../config/feel";
import { renderPixelRatio } from "../../../config/graphics";
import { currentMessages } from "../../../i18n";
import { romanNumeral } from "../../../utils/format";
import { releaseKeyboardLock } from "../../../utils/fullscreen";
import { audioEngine } from "../../audio/audioEngine";
import { soundBank } from "../../audio/soundBank";
import { playHoverTick } from "../../audio/uiSounds";
import { type FrameInput, InputManager } from "../../engine/input/InputManager";
import type { DynamicLight } from "../../engine/lighting/LightPool";
import type { PingClientState } from "../../engine/state/ClientWorldState";
import { PingViews } from "../../engine/world/PingViews";
import { RoomVisibility } from "../../engine/world/RoomVisibility";
import { FIRST_PERSON_LAYER } from "../../engine/player/FirstPersonRig";
import {
	type GiftCandidate,
	InteractionFinder,
	type InteractionTarget,
} from "../../engine/player/Interaction";
import {
	type LocalContext,
	type LocalControls,
	LocalPlayer,
} from "../../engine/player/LocalPlayer";
import { SpottedDetector } from "../../engine/player/SpottedDetector";
import { type HudMarker, MINIMAP_SIZE } from "../../hud/HudCanvas";
import {
	hudStore,
	type LeaderboardRow,
	pushFeedback,
	type StatsHud,
	type StatsLine,
} from "../../hud/hudStore";
import {
	type MapMarker,
	type MapPoint,
	MapRenderer,
	roomLabel,
} from "../../map/MapRenderer";
import { mapStore, panMap, resetMap, zoomMap } from "../../map/mapStore";
import { clockSync } from "../../network/clockSync";
import { type GameSocket, getSocket } from "../../network/socket";
import { addPhoto, clearPhotos, photoStore } from "../../photos/photoStore";
import { activeDevModes, devModesStore } from "../../settings/devModesStore";
import { settingsStore } from "../../settings/settingsStore";
import { doubleVoices, speakRadioClip } from "../../voice/doubleVoices";
import { micManager } from "../../voice/micManager";
import { momentVoices } from "../../voice/momentVoices";
import type { ActionId } from "../../../types/settings";
import { voiceChat, voiceStore } from "../../voice/voiceChat";
import { CastController } from "../CastController";
import { replayStore } from "../replayStore";
import { resetVote, voteStore } from "../voteStore";
import { ReplayDirector } from "./ReplayDirector";
import {
	type LoadedWorld,
	type LoadStepId,
	loadSession,
} from "./SessionLoader";
import { TutorialController } from "./TutorialController";

const HUD_INTERVAL_MS = 80;
const DOOR_PREDICTION_MS = 900;
const LANTERN_RECONCILE_MS = 700;
const JUMP_ENERGY_SETTLE_MS = 600;
const HIDDEN_GLOW = { color: 0x7d8aa0, intensity: 0.55, range: 1.4 };
const RADIO_GHOST_MIN_MS = 25_000;
const RADIO_GHOST_EXTRA_MS = 30_000;
const REPLAY_FOV = 62;
const VOICE_CLIPS_GRACE_MS = 5_000;

function wrapIndex(index: number, length: number): number {
	return ((index % length) + length) % length;
}

const RADIO_TALKING_LEVEL = 0.12;
const WHEEL_DEADZONE = 28;
const THIRD_PERSON_DISTANCE = 2.7;
const THIRD_PERSON_PIVOT = 1.15;
const THIRD_PERSON_SHOWN = 0.2;
const EMOTE_BREAKING_HOLDS: readonly ActionId[] = [
	"moveForward",
	"moveBackward",
	"moveLeft",
	"moveRight",
	"jump",
	"crouch",
	"sprint",
];
const EMOTE_BREAKING_PRESSES: readonly ActionId[] = [
	"interact",
	"lantern",
	"push",
	"shout",
	"grimoire",
	"camera",
	"aim",
	"photo",
	"radio",
	"power",
	"ping",
	"map",
];
const STATS_FRAMES = 90;

interface WheelState {
	kind: "ping" | "emote";
	x: number;
	y: number;
	selected: number | null;
}

function hex(color: number): string {
	return `#${color.toString(16).padStart(6, "0")}`;
}

export class GameSession {
	private loadedWorld: LoadedWorld | null = null;
	private player: LocalPlayer | null = null;
	private input: InputManager | null = null;
	private finder: InteractionFinder | null = null;
	private spotted: SpottedDetector | null = null;
	private mapRenderer: MapRenderer | null = null;
	private minimapKey = "";
	private readonly cast: CastController;
	private stopDevModes: () => void = () => {};
	private readonly hazeColor = new THREE.Color(HAZE_COLOR);
	private container: HTMLElement | null = null;
	private frameHandle = 0;
	private clockSecond = -1;
	private lastFrame = 0;
	private lastRender = 0;
	private fpsFrames = 0;
	private fpsTime = 0;
	private fps = 0;
	private beginInfo: MatchBegin | null = null;
	private seq = 0;
	private lastSendAt = 0;
	private voicePeak = 0;
	private voiceActiveMs = 0;
	private lanternIntent = false;
	private lanternChangedAt = -Infinity;
	private pushReadyAt = 0;
	private shoutReadyAt = 0;
	private carriedBy: number | null = null;
	private heldResonance = 0;
	private wasPetrified = false;
	private hideSpot = -1;
	private selfLiquid: LiquidVolume | null = null;
	private nausea = 0;
	private gaze = 0;
	private readonly gorgonGaze = new Map<number, number>();
	private jumpSpentAt: number[] = [];
	private leaderboardHeld = false;
	private readonly markerBlender = new PlayerMarkerBlender();
	private haze = 0;
	private clearAir: { density: number; color: THREE.Color } | null = null;
	private mapOpen = false;
	private mapScale = 1;
	private mezzanineNeighbors: Set<number> | null = null;
	private roomVisibility: RoomVisibility | null = null;
	private roomsShown: Uint8Array | null = null;
	private mapDrag: { x: number; y: number } | null = null;
	private pointerEverLocked = false;
	private intentionalUnlock = false;
	private hudPublishedAt = 0;
	private interaction: InteractionTarget | null = null;
	private tutorial: TutorialController | null = null;
	private altarId: number | null = null;
	private altarSelected = 0;
	private heldSlot = 0;
	private inventory: PlayerInventory | null = null;
	private lookAccumulator = { x: 0, y: 0 };
	private interpolationDelay = CLIENT_INTERPOLATION_DELAY_MS;
	private disposed = false;
	private started = false;
	private readonly dynamicLights: DynamicLight[] = [];
	private readonly selfDamageAt = { value: 0 };
	private radioOn = false;
	private cameraRaised = false;
	private cameraAiming = false;
	private photoPending = false;
	private radioGhostAt = 0;
	private radioGhostName: string | null = null;
	private radioGhostUntil = 0;
	private replay: ReplayDirector | null = null;
	private onReplayDone: (() => void) | null = null;
	private ghostLimits: GhostBounds | null = null;
	private wasGhost = false;
	private ghostDoorReadyAt = 0;
	private ghostKnockReadyAt = 0;
	private wheel: WheelState | null = null;
	private pingPressedAt: number | null = null;
	private gift: { playerId: string; name: string; selected: number } | null =
		null;
	private powerReadyAt = 0;
	private powerPendingUntil = 0;
	private roleShownAt = 0;
	private voting = false;
	private readonly frameTimes: number[] = [];
	private pingViews: PingViews | null = null;
	private readonly arrowAngles = new Map<number, number>();
	private readonly pingTimes: number[] = [];
	private soloPingNoted = false;
	private localEmote: {
		emote: EmoteId;
		startedAt: number;
		until: number;
		yaw: number;
	} | null = null;
	private emoteReadyAt = 0;
	private thirdPerson = 0;
	private readonly snapshotArrivals: { at: number; tick: number }[] = [];
	private statsPublishedAt = 0;
	private stats: StatsHud | null = null;

	constructor(
		readonly init: MatchInit,
		readonly selfId: string,
	) {
		this.cast = new CastController(
			{
				begin: () => getSocket().emit("game:castBegin"),
				cancel: () => getSocket().emit("game:castCancel"),
				cast: (transcripts) =>
					getSocket().emit("game:cast", { transcripts, method: "speech" }),
			},
			{
				entries: () =>
					init.roster.map((entry) => ({
						id: entry.id,
						label: this.anomalyLabel(entry.id) ?? entry.species,
						words: entry.formula,
					})),
			},
			init.dev,
			init.tutorial,
		);
		if (init.dev) {
			this.stopDevModes = devModesStore.subscribe((modes) =>
				getSocket().emit("game:devModes", modes),
			);
			getSocket().emit("game:devModes", devModesStore.get());
		}
	}

	get matchId(): string {
		return this.init.matchId;
	}

	get isLoaded(): boolean {
		return this.loadedWorld !== null;
	}

	async load(
		progress: (step: LoadStepId, fraction: number) => void,
	): Promise<void> {
		const loaded = await loadSession(this.init, this.selfId, progress);
		if (this.disposed) {
			this.disposeWorld(loaded);
			return;
		}
		this.loadedWorld = loaded;
		clearPhotos();
		const spawn = this.init.players.find((player) => player.id === this.selfId)
			?.spawn ?? {
			x: 0,
			y: 0,
			z: 0,
			yaw: 0,
		};
		this.player = new LocalPlayer(loaded.world, spawn);
		this.finder = new InteractionFinder(
			loaded.layout,
			loaded.world,
			loaded.doors,
			loaded.state,
			loaded.pickups,
			loaded.walkies,
			loaded.cameras,
			this.init.tutorial,
		);
		if (this.init.tutorial) {
			this.tutorial = new TutorialController(this.init, loaded, {
				summon: () => getSocket().emit("game:tutorialSummon"),
				wound: () => getSocket().emit("game:tutorialWound"),
			});
		}
		this.spotted = new SpottedDetector(loaded.world);
		this.mapRenderer = new MapRenderer(loaded.layout);
		this.minimapKey = "";
		this.ghostLimits = this.init.tutorial ? null : ghostBounds(loaded.layout);
		this.pingViews = new PingViews();
		loaded.scene.add(this.pingViews.group);
		loaded.renderer.info.autoReset = false;
		if (this.pendingRole) {
			this.handleRole(this.pendingRole);
			this.pendingRole = null;
		}
		loaded.state.listeners.add((event) => this.onEvent(event));
		hudStore.set({
			remainingMs: this.init.durationMs,
			anomaliesInMs: this.init.anomalySpawnDelayMs,
			health: 100,
			energy: 100,
		});
	}

	get layout() {
		return this.loadedWorld?.layout ?? null;
	}

	get renderer(): MapRenderer | null {
		return this.mapRenderer;
	}

	begin(info: MatchBegin): void {
		this.beginInfo = info;
	}

	attach(container: HTMLElement): void {
		const loaded = this.loadedWorld;
		if (!loaded || this.container) {
			return;
		}
		this.container = container;
		const canvas = loaded.renderer.domElement;
		canvas.tabIndex = 0;
		container.appendChild(canvas);
		this.resize();
		window.addEventListener("resize", this.resize);
		this.input = new InputManager(canvas);
		this.input.attach();
		this.input.onPointerLockChange = (locked) => this.onPointerLock(locked);
		window.addEventListener("keydown", this.onUserGesture);
		window.addEventListener("pointerdown", this.onUserGesture);
		canvas.addEventListener("pointerdown", this.onMapPointerDown);
		canvas.addEventListener("pointermove", this.onMapPointerMove);
		canvas.addEventListener("pointerup", this.onMapPointerUp);
		canvas.addEventListener("pointercancel", this.onMapPointerUp);
		loaded.hud.onMapClose = () => this.closeMap();
		this.pointerEverLocked = false;
		hudStore.set({ paused: false });
		voiceChat.setMode("game");
		if (!this.started) {
			this.started = true;
			loaded.ambientAudio.start();
			if (!this.init.tutorial) {
				momentVoices.start();
			}
		}
		this.lastFrame = performance.now();
		this.frameHandle = requestAnimationFrame(this.frame);
		this.input.requestPointerLock();
	}

	detach(): void {
		cancelAnimationFrame(this.frameHandle);
		window.removeEventListener("resize", this.resize);
		this.input?.detach();
		this.input = null;
		const canvas = this.loadedWorld?.renderer.domElement;
		window.removeEventListener("keydown", this.onUserGesture);
		window.removeEventListener("pointerdown", this.onUserGesture);
		canvas?.removeEventListener("pointerdown", this.onMapPointerDown);
		canvas?.removeEventListener("pointermove", this.onMapPointerMove);
		canvas?.removeEventListener("pointerup", this.onMapPointerUp);
		canvas?.removeEventListener("pointercancel", this.onMapPointerUp);
		canvas?.remove();
		this.container = null;
	}

	resumePointer(): void {
		hudStore.set({ paused: false });
		this.input?.requestPointerLock();
	}

	private readonly onUserGesture = (event: Event) => {
		const { input } = this;
		if (
			!input ||
			input.pointerLocked ||
			this.mapOpen ||
			this.voting ||
			hudStore.get().paused ||
			(event instanceof KeyboardEvent &&
				(event.code === "Escape" || event.repeat))
		) {
			return;
		}
		input.requestPointerLock();
	};

	private onPointerLock(locked: boolean): void {
		if (locked) {
			this.pointerEverLocked = true;
			hudStore.set({ paused: false });
			return;
		}
		if (this.intentionalUnlock || this.mapOpen || this.voting) {
			this.intentionalUnlock = false;
			return;
		}
		if (this.pointerEverLocked) {
			hudStore.set({ paused: true });
		}
	}

	private syncPointer(): void {
		const { input } = this;
		if (!input) {
			return;
		}
		input.reconcilePointerLock();
		const { paused } = hudStore.get();
		if (input.pointerLocked && paused) {
			hudStore.set({ paused: false });
		}
		input.freePlay =
			!input.pointerLocked && !this.mapOpen && !paused && !this.voting;
	}

	private readonly onMapPointerDown = (event: PointerEvent) => {
		const hud = this.loadedWorld?.hud;
		if (!this.mapOpen || !hud || event.button !== 0) {
			return;
		}
		const canvas = event.currentTarget as HTMLCanvasElement;
		const point = hud.pointer(event.clientX, event.clientY, canvas);
		if (hud.pressMap(point)) {
			return;
		}
		if (hud.inMapArea(point)) {
			this.mapDrag = point;
			canvas.setPointerCapture(event.pointerId);
			canvas.style.cursor = "grabbing";
		}
	};

	private readonly onMapPointerMove = (event: PointerEvent) => {
		const hud = this.loadedWorld?.hud;
		if (!this.mapOpen || !hud) {
			return;
		}
		const canvas = event.currentTarget as HTMLCanvasElement;
		const point = hud.pointer(event.clientX, event.clientY, canvas);
		if (this.mapDrag) {
			panMap(
				-(point.x - this.mapDrag.x) / this.mapScale,
				-(point.y - this.mapDrag.y) / this.mapScale,
			);
			this.mapDrag = point;
			return;
		}
		this.updateMapCursor(canvas, hud, point);
	};

	private readonly onMapPointerUp = (event: PointerEvent) => {
		const hud = this.loadedWorld?.hud;
		this.mapDrag = null;
		if (!this.mapOpen || !hud) {
			return;
		}
		const canvas = event.currentTarget as HTMLCanvasElement;
		this.updateMapCursor(
			canvas,
			hud,
			hud.pointer(event.clientX, event.clientY, canvas),
		);
	};

	private updateMapCursor(
		canvas: HTMLCanvasElement,
		hud: LoadedWorld["hud"],
		point: { x: number; y: number },
	): void {
		const before = hud.hoveredMapButton;
		const hover = hud.hoverMap(point);
		if (hover && hud.hoveredMapButton !== before) {
			playHoverTick();
		}
		canvas.style.cursor = hover
			? "pointer"
			: hud.inMapArea(point)
				? "grab"
				: "default";
	}

	private readonly resize = () => {
		const loaded = this.loadedWorld;
		if (!loaded || !this.container) {
			return;
		}
		const settings = settingsStore.get();
		const width = this.container.clientWidth || window.innerWidth;
		const height = this.container.clientHeight || window.innerHeight;
		loaded.renderer.setPixelRatio(
			renderPixelRatio(settings.quality, settings.renderScale),
		);
		loaded.particles.setPixelRatio(loaded.renderer.getPixelRatio());
		loaded.renderer.setSize(width, height, false);
		loaded.renderer.domElement.style.width = "100%";
		loaded.renderer.domElement.style.height = "100%";
		loaded.camera.aspect = width / Math.max(1, height);
		loaded.camera.updateProjectionMatrix();
		loaded.hud.resize(width, height);
		loaded.post.setHud(
			loaded.hud.texture,
			loaded.hud.pixelWidth,
			loaded.hud.pixelHeight,
		);
	};

	handleSnapshot(snapshot: WorldSnapshot): void {
		const loaded = this.loadedWorld;
		if (!loaded) {
			return;
		}
		const arrival = clockSync.rawServerNow();
		const lag = arrival - snapshot.t;
		const target = Math.min(
			320,
			Math.max(
				CLIENT_INTERPOLATION_DELAY_MS,
				100 + clockSync.jitter * 2 + Math.max(0, lag),
			),
		);
		this.interpolationDelay += (target - this.interpolationDelay) * 0.1;
		this.snapshotArrivals.push({ at: performance.now(), tick: snapshot.tick });
		if (this.snapshotArrivals.length > 120) {
			this.snapshotArrivals.shift();
		}
		loaded.state.applySnapshot(snapshot);
	}

	handleEvents(events: GameEvent[], serverTime: number): void {
		this.loadedWorld?.state.applyEvents(events, serverTime);
	}

	handleForcedMove(move: ForcedMove): void {
		if (move.playerId !== this.selfId || !this.player) {
			return;
		}
		if (move.kind !== "correction") {
			this.cancelEmote(true);
		}
		this.player.applyForcedMove(move);
		if (move.kind === "hide") {
			this.hideSpot = move.hideSpot;
			soundBank.play("hide", { volume: 0.6 });
			this.lanternIntent = false;
		} else if (
			move.kind === "unhide" ||
			move.kind === "extract" ||
			move.kind === "respawn" ||
			move.kind === "drop" ||
			move.kind === "spawn"
		) {
			this.hideSpot = -1;
		}
		if (move.kind === "drop" || move.kind === "respawn") {
			this.carriedBy = null;
		}
	}

	handleInventory(inventory: PlayerInventory): void {
		this.inventory = inventory;
		hudStore.set({ inventory });
	}

	private setAltar(altarId: number | null): void {
		this.altarId = altarId;
		if (altarId !== null) {
			const craftable = OCCULT_IDS.findIndex((object) => this.canCraft(object));
			this.altarSelected = Math.max(0, craftable);
		}
		hudStore.set({
			altarOpen: altarId !== null,
			altarSelected: this.altarSelected,
		});
	}

	private canCraft(object: OccultId): boolean {
		const materials = this.inventory?.materials;
		return (
			materials !== undefined &&
			(Object.entries(OCCULT_RECIPES[object]) as [MaterialId, number][]).every(
				([material, count]) => materials[material] >= count,
			)
		);
	}

	private selectAltarRow(index: number): void {
		this.altarSelected = wrapIndex(index, OCCULT_IDS.length);
		hudStore.set({ altarSelected: this.altarSelected });
	}

	private craftSelected(): void {
		const object = OCCULT_IDS[this.altarSelected];
		if (this.altarId !== null && this.canCraft(object)) {
			getSocket().emit("game:craft", { altarId: this.altarId, object });
		}
	}

	private updateAltar(frame: FrameInput, player: LocalPlayer): void {
		const altar =
			this.altarId === null
				? undefined
				: (this.loadedWorld as LoadedWorld).layout.altars[this.altarId];
		if (!altar) {
			return;
		}
		if (
			frame.escape ||
			Math.hypot(player.character.x - altar.x, player.character.z - altar.z) >
				ALTAR_INTERACT_RANGE + 0.5
		) {
			this.setAltar(null);
			return;
		}
		for (const digit of frame.digits) {
			if (OCCULT_IDS[digit - 1]) {
				this.selectAltarRow(digit - 1);
				this.craftSelected();
			}
		}
	}

	private altarPrompt(): string {
		const object = OCCULT_IDS[this.altarSelected];
		const messages = currentMessages();
		return this.canCraft(object)
			? messages.game.interaction.craft(messages.grimoire.objects[object])
			: messages.game.interaction.missingMaterials;
	}

	private selectHeldSlot(index: number): void {
		this.heldSlot = wrapIndex(index, OCCULT_IDS.length);
		hudStore.set({ heldSlot: this.heldSlot });
	}

	private heldObject(): OccultId | null {
		const object = OCCULT_IDS[this.heldSlot];
		return (this.inventory?.objects[object] ?? 0) > 0 ? object : null;
	}

	private handleWheelAndDigits(frame: FrameInput): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const step = Math.sign(frame.wheel);
		if (this.gift) {
			if (step !== 0) {
				this.gift.selected = wrapIndex(
					this.gift.selected + step,
					MATERIAL_IDS.length,
				);
				playHoverTick(1.1);
			}
			for (const digit of frame.digits) {
				if (MATERIAL_IDS[digit - 1]) {
					this.gift.selected = digit - 1;
					this.giveSelected();
				}
			}
			return;
		}
		if (this.wheel) {
			return;
		}
		if (this.altarId !== null) {
			if (step !== 0 && !loaded.grimoire.isOpen) {
				this.selectAltarRow(this.altarSelected + step);
			}
			return;
		}
		if (step !== 0 && !loaded.grimoire.isOpen) {
			this.selectHeldSlot(this.heldSlot + step);
		}
		for (const digit of frame.digits) {
			if (OCCULT_IDS[digit - 1]) {
				this.selectHeldSlot(digit - 1);
			}
		}
	}

	handleCastResult(result: CastResult): void {
		if (result.ok) {
			this.tutorial?.notify("captured");
		}
		this.cast.handleResult(
			result,
			(anomalyId) => this.anomalyLabel(anomalyId) ?? "Anomalie",
		);
	}

	closeMap(): void {
		if (!this.mapOpen) {
			return;
		}
		this.mapOpen = false;
		if (this.input) {
			this.input.mode = "game";
		}
		this.mapDrag = null;
		hudStore.set({ showMap: false });
		const loaded = this.loadedWorld;
		if (loaded) {
			loaded.hud.hoverMap(null);
			loaded.renderer.domElement.style.cursor = "";
		}
		this.input?.requestPointerLock();
	}

	private readonly frame = (time: number) => {
		this.frameHandle = requestAnimationFrame(this.frame);
		const settings = settingsStore.get();
		if (
			settings.fpsLimit > 0 &&
			time - this.lastRender < 1000 / settings.fpsLimit - 1
		) {
			return;
		}
		this.lastRender = time;
		const dt = Math.min(0.1, Math.max(0.001, (time - this.lastFrame) / 1000));
		this.lastFrame = time;
		this.trackFps(dt);
		this.frameTimes.push(dt * 1000);
		if (this.frameTimes.length > STATS_FRAMES) {
			this.frameTimes.shift();
		}
		this.syncPointer();
		this.step(dt);
	};

	private trackFps(dt: number): void {
		this.fpsFrames += 1;
		this.fpsTime += dt;
		if (this.fpsTime >= 0.5) {
			this.fps = Math.round(this.fpsFrames / this.fpsTime);
			this.fpsFrames = 0;
			this.fpsTime = 0;
		}
	}

	private step(dt: number): void {
		if (this.replay) {
			this.stepReplay(dt);
			return;
		}
		const loaded = this.loadedWorld;
		const player = this.player;
		const input = this.input;
		if (!loaded || !player || !input) {
			return;
		}
		const settings = settingsStore.get();
		const serverNow = clockSync.serverNow();
		if (
			this.beginInfo &&
			serverNow > this.beginInfo.endsAt + VOICE_CLIPS_GRACE_MS
		) {
			loaded.anomalies.silenceVoices();
			momentVoices.clear();
		}
		momentVoices.update(loaded.state.players.keys(), this.selfId);
		const renderTime = serverNow - this.interpolationDelay;
		loaded.renderer.info.reset();
		const frame = input.frame();
		const self = loaded.state.self?.latest ?? null;
		const flags = self?.flags ?? 0;
		const alive = (flags & PLAYER_FLAG.dead) === 0;
		const ghost = !alive && this.ghostLimits !== null;
		if (ghost !== this.wasGhost) {
			this.wasGhost = ghost;
			if (ghost) {
				soundBank.play("ghost-whoosh", { volume: 0.7 });
			}
			this.closeWheel();
			this.gift = null;
		}
		const restrained =
			this.carriedBy !== null || (flags & PLAYER_FLAG.carried) !== 0;
		this.reconcileLantern(flags, serverNow);
		this.handleActions(frame, alive, restrained, serverNow);
		this.handleSocial(frame, alive, ghost, restrained, serverNow);
		this.checkEmote(frame, alive, ghost, restrained, serverNow);

		const context = this.localContext(settings, flags, alive, renderTime);
		const petrified = (flags & PLAYER_FLAG.petrified) !== 0;
		if (petrified && !this.wasPetrified) {
			pushFeedback(currentMessages().game.hud.petrified, "error");
		}
		this.wasPetrified = petrified;
		const controls = this.controls(
			frame,
			(alive || ghost) && !petrified && !this.voting,
		);
		if (this.wheel) {
			controls.lookX = 0;
			controls.lookY = 0;
		}
		player.update(dt, controls, context);
		for (const event of player.events.splice(0)) {
			if (event.kind === "bounds") {
				pushFeedback(currentMessages().party.ghost.bounds, "info");
			} else if (event.kind === "jump") {
				this.jumpSpentAt.push(performance.now());
				soundBank.play("jump", {
					volume: 0.32,
					rate: 0.95 + Math.random() * 0.1,
				});
			} else if (event.kind === "tired") {
				hudStore.set({ energyDeniedAt: performance.now() });
				soundBank.play("jump", { volume: 0.12, rate: 0.6 });
			} else if (event.speed > 2.5) {
				soundBank.play("land", {
					volume: Math.min(0.9, 0.15 + event.speed * 0.08),
					rate: 0.9 + Math.random() * 0.15,
				});
			}
		}
		this.trackLiquid(player);
		this.nausea = this.nauseaLevel(alive, settings.reduceMotion);
		this.updateCamera(dt, context, settings);

		loaded.camera.updateMatrixWorld(true);
		const eye = loaded.camera.getWorldPosition(new THREE.Vector3());
		const forward = loaded.camera.getWorldDirection(new THREE.Vector3());
		this.dynamicLights.length = 0;
		loaded.remotePlayers.update(dt, renderTime, eye, eye, this.dynamicLights);
		loaded.anomalies.update(dt, renderTime, eye, this.dynamicLights);
		this.heldResonance = loaded.anomalies.resonate(
			alive && this.hideSpot < 0 ? this.heldObject() : null,
			eye,
			dt,
		);
		loaded.doors.update(dt);
		this.reconcileDoors(serverNow);
		loaded.hazards.update(dt, serverNow, this.dynamicLights);
		loaded.decor.update(dt, loaded.camera.position);
		loaded.particles.update(dt);
		loaded.motes.update(dt, loaded.camera.position);
		loaded.pickups.update(dt, loaded.camera.position);
		loaded.altars.update(dt, loaded.camera.position);
		loaded.walkies.update(dt, loaded.camera.position, this.dynamicLights);
		loaded.cameras.update(dt, loaded.camera.position, this.dynamicLights);
		loaded.stakes.update(
			dt,
			loaded.camera.position,
			serverNow,
			this.dynamicLights,
		);
		this.updateRadioGhost();
		this.tutorial?.update({
			frame,
			feet: {
				x: player.character.x,
				y: player.character.y,
				z: player.character.z,
			},
			yaw: player.yaw,
			hidden: this.hideSpot >= 0,
			inventory: this.inventory,
			heldObject: this.heldObject(),
			lanternOpen: this.lanternIntent,
			health: loaded.state.self?.latest?.hp ?? 100,
			serverNow,
			dt,
		});

		this.updateRig(dt, frame, player, settings, eye);
		if (loaded.rig.heldGlow.intensity > 0) {
			this.dynamicLights.push(loaded.rig.heldGlow);
		}
		loaded.lights.update(eye, this.dynamicLights, dt);
		this.cullRooms(eye);
		if (ghost) {
			this.interaction = (this.finder as InteractionFinder).findGhostDoor(
				eye,
				forward,
			);
		} else {
			this.updateTargets(eye, forward, serverNow, player, restrained || !alive);
		}
		if (this.thirdPerson > 0.05) {
			this.interaction = null;
		}
		this.updateMarkers(dt, eye, forward, serverNow);
		const spotted = (this.spotted as SpottedDetector).update(
			dt,
			loaded.camera,
			this.selfId,
			loaded.anomalies.infos(),
			serverNow - loaded.state.latestSnapshotTime,
			performance.now(),
		);
		this.gaze = ghost ? 0 : this.updateGorgonGaze(dt, eye, player);
		this.updateHaze(dt, eye);
		this.updateAudio(dt, eye, forward, player, spotted, serverNow, flags);
		this.cast.update(
			this.beginInfo !== null &&
				alive &&
				!restrained &&
				this.hideSpot < 0 &&
				!this.voting,
		);
		this.sampleVoice(dt);
		this.sendState(serverNow, player);
		this.publishHud(
			serverNow,
			spotted,
			flags,
			self?.hp ?? 100,
			self?.en ?? 100,
		);
		this.updateClock(serverNow);
		const now = performance.now();
		if (loaded.hud.due(now)) {
			this.drawMinimap(player);
			if (this.mapOpen) {
				this.drawBigMap(player, loaded.hud);
			}
			loaded.hud.paint(now);
			loaded.post.setMinimap(
				loaded.hud.minimapShown ? loaded.hud.minimapTexture : null,
				loaded.hud.minimapRect,
				loaded.hud.minimapPixels,
			);
		}
		const wounded = alive && (self?.hp ?? 100) < 30 ? 0.5 : 0;
		this.renderCamera(loaded);
		loaded.post.render(
			{
				dt,
				effects: settings.postEffects,
				tension: Math.max(spotted, wounded, this.gaze * 0.8, this.haze * 0.5),
				animated: !settings.reduceMotion,
				colorLevels: settings.colorLevels,
				desaturate: spotted,
				nausea: this.nausea,
			},
			() => this.render(loaded),
		);
		this.updateStats(loaded, settings);
	}

	private updateClock(serverNow: number): void {
		const endsAt = this.beginInfo?.endsAt;
		if (!endsAt) {
			return;
		}
		const remaining = endsAt - serverNow;
		if (remaining <= 0 || remaining > CLOCK_WARNING_MS) {
			return;
		}
		const second = Math.ceil(remaining / 1000);
		if (second === this.clockSecond) {
			return;
		}
		this.clockSecond = second;
		soundBank.play("clock-tick", {
			bus: "effects",
			variant: second % 2,
			volume: second <= 10 ? 0.8 : 0.55,
		});
	}

	private nauseaLevel(alive: boolean, reduceMotion: boolean): number {
		const loaded = this.loadedWorld as LoadedWorld;
		const serverNow = clockSync.serverNow();
		const brew = alive ? loaded.state.selfBrew(serverNow) : null;
		if (brew?.effect !== "nausea") {
			return 0;
		}
		return (
			Math.min(1, (brew.until - serverNow) / 2000) * (reduceMotion ? 0.35 : 1)
		);
	}

	private brewHud(alive: boolean): {
		brew: BrewEffect | null;
		brewLeftMs: number;
		brewTotalMs: number;
	} {
		const loaded = this.loadedWorld as LoadedWorld;
		const serverNow = clockSync.serverNow();
		const brew = alive ? loaded.state.selfBrew(serverNow) : null;
		return brew
			? {
					brew: brew.effect,
					brewLeftMs: brew.until - serverNow,
					brewTotalMs: BREW_DURATION_MS[brew.effect],
				}
			: { brew: null, brewLeftMs: 0, brewTotalMs: 1 };
	}

	private trackLiquid(player: LocalPlayer): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const liquid =
			this.hideSpot >= 0 || this.carriedBy !== null
				? null
				: liquidAt(loaded.liquids, player.position);
		const previous = this.selfLiquid;
		this.selfLiquid = liquid;
		if (liquid?.itemId === previous?.itemId) {
			return;
		}
		if (liquid) {
			const shallow = liquid.kind === "pond" || liquid.kind === "birdbath";
			const fall = Math.max(0, -player.character.vy);
			soundBank.play(shallow ? "step-water" : "splash", {
				volume: shallow ? 0.55 : Math.min(1, 0.5 + fall * 0.08),
				rate: 0.9 + Math.random() * 0.2,
			});
		} else if (previous) {
			soundBank.play("step-water", { volume: 0.4, rate: 1.1 });
		}
	}

	private inWater(position: { x: number; y: number; z: number }): boolean {
		const loaded = this.loadedWorld as LoadedWorld;
		return liquidAt(loaded.liquids, position) !== null;
	}

	private localContext(
		settings: ReturnType<typeof settingsStore.get>,
		flags: number,
		alive: boolean,
		renderTime: number,
	): LocalContext {
		const loaded = this.loadedWorld as LoadedWorld;
		const player = this.player as LocalPlayer;
		const spot =
			this.hideSpot >= 0 ? loaded.layout.hideSpots[this.hideSpot] : undefined;
		let carriedAnchor = null;
		if (this.carriedBy !== null) {
			const info = loaded.anomalies.info(this.carriedBy);
			carriedAnchor = info
				? { x: info.position.x, y: info.position.y + 0.2, z: info.position.z }
				: null;
		}
		const position = player.position;
		const slimed = loaded.state.isPuddleUnder(
			position.x,
			position.y,
			position.z,
			player.character.grounded,
		);
		const wading = this.inWater(position);
		const brew = alive ? loaded.state.selfBrew(clockSync.serverNow()) : null;
		return {
			sensitivity: settings.mouseSensitivity,
			invertY: settings.invertY,
			sprintAllowed: (flags & PLAYER_FLAG.sprintLocked) === 0,
			jumpAllowed: this.availableEnergy() >= JUMP_MIN_ENERGY,
			speedFactor:
				(slimed ? SLIME_SPEED_FACTOR : wading ? WATER_SPEED_FACTOR : 1) *
				(brew ? BREW_SPEED_FACTOR[brew.effect] : 1),
			gravityFactor: brew ? BREW_GRAVITY_FACTOR[brew.effect] : 1,
			pull: this.archivistPull(position, renderTime),
			alive,
			carriedAnchor,
			hideInterior: spot ? spot.interior : null,
			hideFacing: spot?.facing ?? 0,
			devModes: activeDevModes(this.init.dev),
			ghost: alive ? null : this.ghostLimits,
		};
	}

	private availableEnergy(): number {
		const now = performance.now();
		this.jumpSpentAt = this.jumpSpentAt.filter(
			(time) => now - time < JUMP_ENERGY_SETTLE_MS,
		);
		const energy = this.loadedWorld?.state.self?.latest?.en ?? ENERGY_MAX;
		return energy - this.jumpSpentAt.length * JUMP_ENERGY_COST;
	}

	private archivistPull(
		position: { x: number; y: number; z: number },
		renderTime: number,
	): { x: number; z: number } {
		const loaded = this.loadedWorld as LoadedWorld;
		const room = loaded.world.roomAt(
			{ x: position.x, z: position.z },
			position.y,
		);
		if (!room) {
			return { x: 0, z: 0 };
		}
		for (const anomaly of loaded.state.anomalies.values()) {
			if (!anomaly.active || anomaly.roster.species !== "archiviste") {
				continue;
			}
			const sample = anomaly.buffer.sample(renderTime);
			if (!sample) {
				continue;
			}
			const anomalyRoom = loaded.world.roomAt(
				{ x: sample.x, z: sample.z },
				sample.y + 0.1,
			);
			if (anomalyRoom?.id !== room.id) {
				continue;
			}
			const dx = sample.x - position.x;
			const dz = sample.z - position.z;
			const distance = Math.hypot(dx, dz);
			if (distance < 0.4) {
				return { x: 0, z: 0 };
			}
			return { x: (dx / distance) * 1.15, z: (dz / distance) * 1.15 };
		}
		return { x: 0, z: 0 };
	}

	private controls(frame: FrameInput, alive: boolean): LocalControls {
		const active = alive && !this.mapOpen && (this.input?.capturing ?? false);
		const held = frame.held;
		const axis = (positive: boolean, negative: boolean) =>
			(positive ? 1 : 0) - (negative ? 1 : 0);
		return {
			forward: active
				? axis(held.has("moveForward"), held.has("moveBackward"))
				: 0,
			strafe: active ? axis(held.has("moveRight"), held.has("moveLeft")) : 0,
			sprint: active && held.has("sprint"),
			crouch: held.has("crouch"),
			jump: active && frame.pressed.has("jump"),
			rise: active ? axis(held.has("jump"), held.has("crouch")) : 0,
			lookX: this.input?.capturing && !this.mapOpen ? frame.mouseX : 0,
			lookY: this.input?.capturing && !this.mapOpen ? frame.mouseY : 0,
		};
	}

	private handleActions(
		frame: FrameInput,
		alive: boolean,
		restrained: boolean,
		serverNow: number,
	): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const socket = getSocket();
		const radioOn =
			alive &&
			!restrained &&
			!this.voting &&
			loaded.state.selfHasWalkie &&
			frame.held.has("radio");
		if (radioOn !== this.radioOn) {
			this.radioOn = radioOn;
			socket.emit("game:radio", { on: radioOn });
			soundBank.play("radio-squelch", { volume: 0.4 });
		}
		this.handleCamera(frame, alive && !restrained && !this.voting);
		if (this.voting) {
			return;
		}
		let escapeConsumed = false;
		if (frame.escape && this.mapOpen) {
			this.closeMap();
			escapeConsumed = true;
		}
		if (frame.escape && !escapeConsumed && (this.gift || this.wheel)) {
			this.gift = null;
			this.closeWheel();
			escapeConsumed = true;
		}
		if (
			frame.escape &&
			!escapeConsumed &&
			this.altarId === null &&
			!this.input?.pointerLocked
		) {
			hudStore.set({ paused: true });
		}
		if (frame.pressed.has("map") && !escapeConsumed && this.noMap) {
			pushFeedback(currentMessages().party.mutators.noMap, "info");
		} else if (frame.pressed.has("map") && !escapeConsumed) {
			if (this.mapOpen) {
				this.closeMap();
			} else {
				this.mapOpen = true;
				(this.input as InputManager).mode = "map";
				this.intentionalUnlock = true;
				resetMap(this.currentLevel());
				hudStore.set({ showMap: true });
				loaded.hud.mapLevels = this.layout?.levels ?? [0];
				loaded.renderer.domElement.style.cursor = "default";
				(this.input as InputManager).releasePointerLock();
			}
		}
		const leaderboardHeld = frame.held.has("leaderboard");
		if (leaderboardHeld !== this.leaderboardHeld) {
			this.leaderboardHeld = leaderboardHeld;
			hudStore.set({
				showLeaderboard: leaderboardHeld,
				leaderboard: leaderboardHeld ? this.leaderboardRows() : [],
			});
		}
		if (this.mapOpen) {
			this.handleMapInput(frame);
			return;
		}
		const grimoire = loaded.grimoire;
		if (frame.pressed.has("grimoire") && !restrained) {
			grimoire.setOpen(!grimoire.isOpen);
		}
		if (grimoire.isOpen) {
			if (frame.pressed.has("pageNext") || frame.wheel > 0) {
				grimoire.next();
			}
			if (frame.pressed.has("pagePrevious") || frame.wheel < 0) {
				grimoire.previous();
			}
		}
		if (!alive || restrained) {
			if (this.altarId !== null) {
				this.setAltar(null);
			}
			return;
		}
		const lanternEnergy =
			this.loadedWorld?.state.self?.latest?.en ?? ENERGY_MAX;
		if (frame.pressed.has("lantern") && this.darkness && this.hideSpot < 0) {
			pushFeedback(currentMessages().party.mutators.darkness, "info");
		} else if (
			frame.pressed.has("lantern") &&
			this.hideSpot < 0 &&
			!this.lanternIntent &&
			lanternEnergy < LANTERN_MIN_ENERGY_TO_OPEN
		) {
			hudStore.set({ energyDeniedAt: performance.now() });
			soundBank.play("jump", { volume: 0.12, rate: 0.6 });
		} else if (frame.pressed.has("lantern") && this.hideSpot < 0) {
			this.lanternIntent = !this.lanternIntent;
			this.lanternChangedAt = serverNow;
			soundBank.play(this.lanternIntent ? "lantern-open" : "lantern-close", {
				volume: 0.6,
			});
			socket.emit("game:lantern", { open: this.lanternIntent });
		}
		this.updateAltar(frame, this.player as LocalPlayer);
		this.updateGift(frame);
		this.handleWheelAndDigits(frame);
		if (frame.pressed.has("interact")) {
			if (this.gift) {
				this.giveSelected();
			} else if (this.altarId !== null) {
				if (this.canCraft(OCCULT_IDS[this.altarSelected])) {
					this.craftSelected();
				} else {
					this.setAltar(null);
				}
			} else if (this.interaction) {
				this.interact(this.interaction, serverNow);
			}
		}
		if (frame.pressed.has("push") && serverNow >= this.pushReadyAt) {
			(socket as GameSocket).emit("game:push", {
				yaw: (this.player as LocalPlayer).yaw,
			});
			this.pushReadyAt = serverNow + this.pushCooldownMs;
			soundBank.play("push", { volume: 0.5 });
		}
		if (frame.pressed.has("shout") && serverNow >= this.shoutReadyAt) {
			socket.emit("game:shout");
			this.shoutReadyAt = serverNow + SHOUT_COOLDOWN_MS;
		}
	}

	private handleMapInput(frame: FrameInput): void {
		const state = mapStore.get();
		const step = 6 / state.zoom;
		if (frame.arrows.x !== 0 || frame.arrows.y !== 0) {
			panMap(
				frame.arrows.x * step * 0.08 * 3,
				frame.arrows.y * step * 0.08 * 3,
			);
		}
		if (frame.wheel !== 0) {
			zoomMap(-frame.wheel);
		}
		if (frame.zoomKeys !== 0) {
			zoomMap(frame.zoomKeys);
		}
		if (frame.digits.includes(0)) {
			resetMap();
		}
	}

	private interact(target: InteractionTarget, serverNow: number): void {
		const loaded = this.loadedWorld as LoadedWorld;
		if (target.kind === "altar") {
			if (loaded.state.altarCursed(target.id, serverNow)) {
				pushFeedback(currentMessages().party.possessed.altarCursed, "warning");
				return;
			}
			this.setAltar(target.id);
			return;
		}
		if (target.kind === "gift") {
			this.openGift(target);
			return;
		}
		if (target.kind === "ghostDoor") {
			return;
		}
		if (target.kind === "door" && this.doorsLocked) {
			pushFeedback(currentMessages().party.events.locked, "warning");
			soundBank.play("door-shut", { volume: 0.4, rate: 1.3 });
			return;
		}
		getSocket().emit("game:interact", { kind: target.kind, id: target.id });
		if (target.kind === "door") {
			this.tutorial?.notify("door");
			const door = loaded.doors.doors.get(target.id);
			if (door) {
				const open = !door.targetOpen;
				loaded.doors.setOpen(target.id, open, serverNow + DOOR_PREDICTION_MS);
				loaded.world.setDoorClosed(target.id, !open);
			}
		}
	}

	private reconcileDoors(serverNow: number): void {
		const loaded = this.loadedWorld as LoadedWorld;
		for (const door of loaded.doors.doors.values()) {
			const authoritative = loaded.state.doors.get(door.doorId);
			if (!authoritative || serverNow < door.predictedUntil) {
				continue;
			}
			if (door.targetOpen !== authoritative.open) {
				loaded.doors.setOpen(door.doorId, authoritative.open);
			}
			loaded.world.setDoorClosed(door.doorId, !authoritative.open);
		}
	}

	private reconcileLantern(flags: number, serverNow: number): void {
		const server = (flags & PLAYER_FLAG.lantern) !== 0;
		if (
			server !== this.lanternIntent &&
			serverNow - this.lanternChangedAt > LANTERN_RECONCILE_MS
		) {
			this.lanternIntent = server;
		}
	}

	private updateCamera(
		dt: number,
		context: LocalContext,
		settings: ReturnType<typeof settingsStore.get>,
	): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const player = this.player as LocalPlayer;
		const eye = player.eyePosition(context, dt);
		const camera = loaded.camera;
		camera.position.set(eye.x, eye.y, eye.z);
		let roll = player.deathRoll;
		if (
			settings.headBob &&
			!settings.reduceMotion &&
			player.character.grounded
		) {
			const speed = player.speed;
			const time = performance.now() / 1000;
			camera.position.y +=
				Math.sin(time * (6 + speed * 1.6)) * 0.012 * Math.min(1, speed / 3);
			roll +=
				Math.sin(time * (3 + speed * 0.8)) * 0.004 * Math.min(1, speed / 3);
		}
		if (this.nausea > 0) {
			const time = performance.now() / 1000;
			roll += Math.sin(time * 0.8) * 0.07 * this.nausea;
			camera.position.x += Math.sin(time * 0.53) * 0.03 * this.nausea;
		}
		this.thirdPerson +=
			((this.localEmote ? 1 : 0) - this.thirdPerson) * Math.min(1, dt * 5);
		if (this.thirdPerson < 0.002) {
			this.thirdPerson = 0;
		}
		if (this.thirdPerson > 0) {
			const blend = THREE.MathUtils.smootherstep(this.thirdPerson, 0, 1);
			const pitch = THREE.MathUtils.lerp(
				player.pitch,
				THREE.MathUtils.clamp(player.pitch, -0.85, 0.3),
				blend,
			);
			const shot = this.thirdPersonEye(player, pitch);
			camera.position.lerp(shot, blend);
			camera.rotation.set(pitch, player.yaw, roll * (1 - blend), "YXZ");
		} else {
			camera.rotation.set(player.pitch, player.yaw, roll, "YXZ");
		}
		this.showSelfModel(player);
		if (camera.fov !== settings.fov) {
			camera.fov = settings.fov;
			camera.updateProjectionMatrix();
		}
		loaded.renderer.toneMappingExposure = settings.brightness;
		if (
			loaded.renderer.getPixelRatio() !==
			renderPixelRatio(settings.quality, settings.renderScale)
		) {
			this.resize();
		}
	}

	private thirdPersonEye(player: LocalPlayer, pitch: number): THREE.Vector3 {
		const loaded = this.loadedWorld as LoadedWorld;
		const feet = player.position;
		const pivot = new THREE.Vector3(
			feet.x,
			feet.y + THIRD_PERSON_PIVOT,
			feet.z,
		);
		const direction = new THREE.Vector3(
			-Math.sin(player.yaw) * Math.cos(pitch),
			Math.sin(pitch),
			-Math.cos(player.yaw) * Math.cos(pitch),
		);
		const wanted = pivot
			.clone()
			.addScaledVector(direction, -THIRD_PERSON_DISTANCE);
		const room = loaded.world.roomAt({ x: feet.x, z: feet.z }, feet.y + 0.1);
		if (room) {
			wanted.y = THREE.MathUtils.clamp(
				wanted.y,
				room.floorY + 0.35,
				room.ceilingY - 0.25,
			);
		}
		const clear = pullBackToSight(loaded.world, pivot, wanted, 0.2);
		const shot = new THREE.Vector3(clear.x, clear.y, clear.z);
		if (shot.distanceTo(pivot) < THIRD_PERSON_DISTANCE - 0.05) {
			shot.lerp(pivot, 0.12);
		}
		return shot;
	}

	private showSelfModel(player: LocalPlayer): void {
		const loaded = this.loadedWorld as LoadedWorld;
		if (this.thirdPerson < THIRD_PERSON_SHOWN) {
			loaded.remotePlayers.showSelf(null);
			return;
		}
		const emote = this.localEmote;
		const serverNow = clockSync.serverNow();
		const flags = loaded.state.self?.latest?.flags ?? 0;
		loaded.remotePlayers.showSelf({
			...player.position,
			yaw: emote?.yaw ?? player.yaw,
			emote: emote?.emote ?? null,
			emoteTime: emote ? Math.max(0, (serverNow - emote.startedAt) / 1000) : 0,
			lanternOpen: this.lanternIntent && this.hideSpot < 0,
			ghost: (flags & PLAYER_FLAG.dead) !== 0 && this.ghostLimits !== null,
			talking: micManager.voiceActive() ? micManager.measure() : 0,
			walkie: loaded.state.selfHasWalkie,
			heldObject: this.heldObject(),
		});
	}

	private checkEmote(
		frame: FrameInput,
		alive: boolean,
		ghost: boolean,
		restrained: boolean,
		serverNow: number,
	): void {
		const emote = this.localEmote;
		if (!emote) {
			return;
		}
		if (serverNow >= emote.until) {
			this.localEmote = null;
			return;
		}
		const moving =
			EMOTE_BREAKING_HOLDS.some((action) => frame.held.has(action)) ||
			EMOTE_BREAKING_PRESSES.some((action) => frame.pressed.has(action));
		if (
			moving ||
			restrained ||
			this.voting ||
			this.hideSpot >= 0 ||
			(!alive && !ghost)
		) {
			this.cancelEmote(true);
		}
	}

	private cancelEmote(notify: boolean): void {
		if (!this.localEmote) {
			return;
		}
		this.localEmote = null;
		if (notify) {
			getSocket().emit("game:emote", { emote: null });
		}
	}

	private handleCamera(frame: FrameInput, able: boolean): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const canAim =
			able &&
			this.hideSpot < 0 &&
			loaded.state.selfHasCamera &&
			!loaded.grimoire.isOpen &&
			!this.mapOpen &&
			this.altarId === null;
		if (!canAim) {
			this.cameraRaised = false;
			this.setCameraAiming(loaded, false);
			return;
		}
		if (frame.pressed.has("camera")) {
			this.cameraRaised = !this.cameraRaised;
		}
		this.setCameraAiming(loaded, frame.held.has("aim"));
		if (
			this.cameraUp &&
			frame.pressed.has("photo") &&
			loaded.rig.cameraUp &&
			!this.photoPending
		) {
			if (photoStore.get().photos.length >= MAX_PHOTOS_PER_MATCH) {
				pushFeedback(
					currentMessages().game.camera.full(MAX_PHOTOS_PER_MATCH),
					"info",
				);
			} else {
				this.photoPending = true;
			}
		}
	}

	private get cameraUp(): boolean {
		return this.cameraRaised || this.cameraAiming;
	}

	private setCameraAiming(loaded: LoadedWorld, aiming: boolean): void {
		if (aiming === this.cameraAiming) {
			return;
		}
		this.cameraAiming = aiming;
		loaded.photoCamera.setPreviewDetail(aiming);
	}

	private renderCamera(loaded: LoadedWorld): void {
		if (!this.cameraUp && !this.photoPending) {
			return;
		}
		const { renderer, scene, camera, photoCamera } = loaded;
		photoCamera.renderPreview(renderer, scene, camera);
		if (!this.photoPending) {
			return;
		}
		this.photoPending = false;
		loaded.rig.flashPhoto();
		soundBank.play("camera-shutter", { volume: 0.7 });
		hudStore.set({ photoFlashAt: performance.now() });
		void photoCamera
			.capture(renderer, scene, camera, loaded.post)
			.then((blob) => {
				if (blob) {
					addPhoto(blob);
				}
			});
	}

	private updateRig(
		dt: number,
		frame: FrameInput,
		player: LocalPlayer,
		settings: ReturnType<typeof settingsStore.get>,
		eye: THREE.Vector3,
	): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const self = loaded.state.self?.latest;
		const alive = self ? (self.flags & PLAYER_FLAG.dead) === 0 : true;
		this.lookAccumulator.x = frame.mouseX;
		this.lookAccumulator.y = frame.mouseY;
		loaded.rig.update(dt, {
			grimoireOpen: loaded.grimoire.isOpen,
			heldObject: this.heldObject(),
			heldResonance: this.heldResonance,
			cameraRaised: this.cameraUp,
			cameraAimed: this.cameraAiming,
			lanternOpen: this.lanternIntent && this.hideSpot < 0,
			speed: player.speed,
			crouch: player.character.crouch,
			lookDeltaX: settings.reduceMotion ? 0 : this.lookAccumulator.x,
			lookDeltaY: settings.reduceMotion ? 0 : this.lookAccumulator.y,
			yaw: player.yaw,
			pitch: player.pitch,
			swing: settings.reduceMotion ? 0.35 : 1,
			headBob: settings.headBob && !settings.reduceMotion,
			reduceMotion: settings.reduceMotion,
			visible:
				alive &&
				this.carriedBy === null &&
				this.hideSpot < 0 &&
				this.thirdPerson < THIRD_PERSON_SHOWN,
			fov: settings.fov,
			aspect: loaded.camera.aspect,
		});
		loaded.body.update(dt, {
			x: eye.x,
			y: player.position.y,
			z: eye.z,
			yaw: player.yaw,
			speed: player.speed,
			crouch: player.character.crouch,
			grounded: player.character.grounded,
			visible:
				alive &&
				this.carriedBy === null &&
				this.hideSpot < 0 &&
				this.thirdPerson < THIRD_PERSON_SHOWN,
		});
		const lantern = loaded.worldLantern;
		if (this.hideSpot >= 0) {
			lantern.position.copy(eye);
			lantern.color.setHex(HIDDEN_GLOW.color);
			lantern.intensity = HIDDEN_GLOW.intensity;
			lantern.distance = HIDDEN_GLOW.range;
			return;
		}
		const local = loaded.rig.lanternLocalPosition();
		const held = loaded.camera.localToWorld(local.clone());
		const worn =
			this.thirdPerson >= THIRD_PERSON_SHOWN
				? loaded.remotePlayers.selfLanternPosition()
				: null;
		lantern.position.copy(
			worn ?? pullBackToSight(loaded.world, eye, held, 0.06),
		);
		const tint = loaded.state.self?.lantern ?? DEFAULT_LANTERN_TINT;
		lantern.color.setHex(
			tint === DEFAULT_LANTERN_TINT ? LANTERN_COLOR : LANTERN_TINT_COLORS[tint],
		);
		lantern.intensity = LANTERN_LIGHT_INTENSITY * loaded.rig.lanternLevelValue;
		lantern.distance = LANTERN_LIGHT_RANGE;
	}

	private roomsAroundMezzanines(): Set<number> {
		if (!this.mezzanineNeighbors) {
			const { rooms, openings } = (this.loadedWorld as LoadedWorld).layout;
			this.mezzanineNeighbors = new Set(
				openings.flatMap((opening) =>
					rooms[opening.roomA].mezzanine || rooms[opening.roomB].mezzanine
						? [opening.roomA, opening.roomB]
						: [],
				),
			);
		}
		return this.mezzanineNeighbors;
	}

	private cullRooms(eye: THREE.Vector3): void {
		const loaded = this.loadedWorld as LoadedWorld;
		if (!this.roomVisibility || !this.roomsShown) {
			this.roomVisibility = new RoomVisibility(loaded.layout);
			this.roomsShown = new Uint8Array(loaded.layout.rooms.length);
		}
		const shown = this.roomsShown;
		const portals = this.roomVisibility.update(loaded.camera, eye, (doorId) =>
			loaded.doors.isShut(doorId),
		);
		const seen = this.roomVisibility.visible;
		const aroundMezzanines = this.roomsAroundMezzanines();
		for (const room of loaded.rooms) {
			const dx = Math.max(
				room.room.bounds.minX - eye.x,
				0,
				eye.x - room.room.bounds.maxX,
			);
			const dz = Math.max(
				room.room.bounds.minZ - eye.z,
				0,
				eye.z - room.room.bounds.maxZ,
			);
			const distance = Math.hypot(dx, dz);
			let visible: boolean;
			if (portals) {
				visible = distance < 42 && seen[room.room.id] === 1;
			} else {
				const verticalGap =
					room.room.type === "stairwell" || aroundMezzanines.has(room.room.id)
						? 0
						: Math.max(0, Math.abs(room.room.floorY + 1.5 - eye.y) - 3.2);
				visible =
					distance < 42 &&
					(verticalGap < 0.1 ||
						(distance < STAIR_PRELOAD_RANGE && verticalGap < LEVEL_HEIGHT));
			}
			room.group.visible = visible;
			shown[room.room.id] = visible ? 1 : 0;
		}
		loaded.doors.cull(shown);
		loaded.pickups.cull(shown);
	}

	private updateTargets(
		eye: THREE.Vector3,
		forward: THREE.Vector3,
		serverNow: number,
		player: LocalPlayer,
		restrained: boolean,
	): void {
		const loaded = this.loadedWorld as LoadedWorld;
		if (restrained) {
			this.interaction = null;
			loaded.grimoire.refresh();
			return;
		}
		const finder = this.finder as InteractionFinder;
		const feet = new THREE.Vector3(
			player.character.x,
			player.character.y,
			player.character.z,
		);
		this.interaction = finder.find(
			eye,
			forward,
			feet,
			this.hideSpot,
			serverNow,
			this.giftCandidates(),
			this.doorsLocked,
		);
		loaded.grimoire.refresh();
	}

	private giftCandidates(): GiftCandidate[] {
		const loaded = this.loadedWorld as LoadedWorld;
		if (this.init.tutorial) {
			return [];
		}
		const people: GiftCandidate[] = [];
		for (const player of loaded.state.players.values()) {
			const flags = player.latest?.flags ?? PLAYER_FLAG.dead;
			if (
				player.id === this.selfId ||
				(flags &
					(PLAYER_FLAG.dead | PLAYER_FLAG.hidden | PLAYER_FLAG.carried)) !==
					0
			) {
				continue;
			}
			const position = loaded.remotePlayers.positionOf(player.id);
			if (position) {
				people.push({
					id: player.id,
					name: player.name,
					chest: new THREE.Vector3(
						position.x,
						position.y + 1.05 - (player.latest?.crouch ?? 0) * 0.35,
						position.z,
					),
				});
			}
		}
		return people;
	}

	private get noMap(): boolean {
		return hasMutator(this.init.config, "noMap");
	}

	private get darkness(): boolean {
		return hasMutator(this.init.config, "darkness");
	}

	private get pushCooldownMs(): number {
		return hasMutator(this.init.config, "strongPush")
			? PUSH_COOLDOWN_MS * STRONG_PUSH_COOLDOWN_FACTOR
			: PUSH_COOLDOWN_MS;
	}

	private get doorsLocked(): boolean {
		const event = this.loadedWorld?.state.manorEvent;
		const now = clockSync.serverNow();
		return (
			event?.kind === "lockdown" &&
			event.phase === "start" &&
			now >= event.startsAt &&
			now < event.endsAt
		);
	}

	private openGift(target: InteractionTarget): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const materials = this.inventory?.materials;
		if (!target.playerId || !materials) {
			return;
		}
		const owned = MATERIAL_IDS.findIndex((id) => materials[id] > 0);
		if (owned < 0) {
			pushFeedback(currentMessages().party.gift.none, "info");
			return;
		}
		this.gift = {
			playerId: target.playerId,
			name: loaded.state.players.get(target.playerId)?.name ?? "",
			selected: owned,
		};
	}

	private updateGift(frame: FrameInput): void {
		const gift = this.gift;
		if (!gift) {
			return;
		}
		const loaded = this.loadedWorld as LoadedWorld;
		const position = loaded.remotePlayers.positionOf(gift.playerId);
		const target = loaded.state.players.get(gift.playerId)?.latest;
		const player = this.player as LocalPlayer;
		if (
			frame.escape ||
			!position ||
			!target ||
			(target.flags & PLAYER_FLAG.dead) !== 0 ||
			Math.hypot(
				position.x - player.character.x,
				position.z - player.character.z,
			) > 3.6
		) {
			this.gift = null;
		}
	}

	private giveSelected(): void {
		const gift = this.gift;
		const material = gift ? MATERIAL_IDS[gift.selected] : undefined;
		if (!gift || !material) {
			return;
		}
		if ((this.inventory?.materials[material] ?? 0) < 1) {
			soundBank.play("capture-fail", { volume: 0.3 });
			return;
		}
		getSocket().emit("game:gift", { targetId: gift.playerId, material });
	}

	private handleSocial(
		frame: FrameInput,
		alive: boolean,
		ghost: boolean,
		restrained: boolean,
		serverNow: number,
	): void {
		if (this.voting || this.init.tutorial) {
			this.closeWheel();
			this.pingPressedAt = null;
			return;
		}
		const able = (alive && !restrained) || ghost;
		const now = performance.now();
		if (this.wheel) {
			this.wheel.x += frame.mouseX;
			this.wheel.y += frame.mouseY;
			const count =
				this.wheel.kind === "ping" ? PING_WHEEL.length : EMOTE_IDS.length;
			if (Math.hypot(this.wheel.x, this.wheel.y) > WHEEL_DEADZONE) {
				const step = (Math.PI * 2) / count;
				const angle = Math.atan2(this.wheel.y, this.wheel.x) + Math.PI / 2;
				const selected = wrapIndex(Math.round(angle / step), count);
				if (selected !== this.wheel.selected) {
					playHoverTick(1.1);
				}
				this.wheel.selected = selected;
			}
		}
		if (!able || this.mapOpen) {
			this.closeWheel();
			this.pingPressedAt = null;
		} else {
			if (frame.pressed.has("ping")) {
				this.pingPressedAt = now;
			}
			if (
				this.pingPressedAt !== null &&
				!this.wheel &&
				frame.held.has("ping") &&
				now - this.pingPressedAt > PING_HOLD_MS
			) {
				this.openWheel("ping");
			}
			if (frame.released.has("ping") && this.pingPressedAt !== null) {
				const wheel = this.wheel?.kind === "ping" ? this.wheel : null;
				this.pingPressedAt = null;
				if (wheel) {
					const kind =
						wheel.selected === null ? null : PING_WHEEL[wheel.selected];
					this.closeWheel();
					if (kind) {
						this.sendPing(kind);
					}
				} else {
					this.sendPing(null);
				}
			}
			if (frame.pressed.has("emote") && !this.wheel) {
				this.openWheel("emote");
			}
			if (frame.released.has("emote") && this.wheel?.kind === "emote") {
				const emote =
					this.wheel.selected === null ? null : EMOTE_IDS[this.wheel.selected];
				this.closeWheel();
				if (emote) {
					this.sendEmote(emote);
				}
			}
		}
		if (ghost) {
			if (
				frame.pressed.has("interact") &&
				this.interaction?.kind === "ghostDoor" &&
				serverNow >= this.ghostDoorReadyAt
			) {
				getSocket().emit("game:ghost", {
					kind: "door",
					id: this.interaction.id,
				});
				this.ghostDoorReadyAt = serverNow + GHOST_DOOR_COOLDOWN_MS;
			}
			if (frame.pressed.has("shout") && serverNow >= this.ghostKnockReadyAt) {
				getSocket().emit("game:ghost", { kind: "knock", id: -1 });
				this.ghostKnockReadyAt = serverNow + GHOST_KNOCK_COOLDOWN_MS;
			}
		}
		if (
			alive &&
			!restrained &&
			this.hideSpot < 0 &&
			frame.pressed.has("power") &&
			this.loadedWorld?.state.role?.role === "possessed"
		) {
			this.castPower(serverNow);
		}
	}

	private openWheel(kind: "ping" | "emote"): void {
		this.wheel = { kind, x: 0, y: 0, selected: null };
	}

	private closeWheel(): void {
		this.wheel = null;
	}

	private aimPoint(
		eye: THREE.Vector3,
		forward: THREE.Vector3,
		range: number,
	): THREE.Vector3 {
		const loaded = this.loadedWorld as LoadedWorld;
		const far = eye.clone().addScaledVector(forward, range);
		const clear = pullBackToSight(loaded.world, eye, far, 0.05);
		const end = new THREE.Vector3(clear.x, clear.y, clear.z);
		const length = end.distanceTo(eye);
		const probe = new THREE.Vector3();
		for (let distance = 0.3; distance <= length; distance += 0.2) {
			probe.copy(eye).addScaledVector(forward, distance);
			const room = loaded.world.roomAt({ x: probe.x, z: probe.z }, probe.y);
			if (!room) {
				continue;
			}
			if (probe.y <= room.floorY + 0.02) {
				return new THREE.Vector3(probe.x, room.floorY, probe.z);
			}
			if (probe.y >= room.ceilingY - 0.02) {
				return probe.clone();
			}
		}
		return end;
	}

	private aimedAnomaly(
		eye: THREE.Vector3,
		forward: THREE.Vector3,
		limit: number,
	): number | null {
		const loaded = this.loadedWorld as LoadedWorld;
		let best: { id: number; angle: number } | null = null;
		for (const info of loaded.anomalies.infos()) {
			const offset = info.center.clone().sub(eye);
			const distance = offset.length();
			if (distance > limit + 0.5 || distance > PING_MAX_DISTANCE) {
				continue;
			}
			const angle = offset.normalize().angleTo(forward);
			const tolerance = Math.max(0.06, Math.atan2(info.radius, distance));
			if (angle < tolerance && (!best || angle < best.angle)) {
				best = { id: info.id, angle };
			}
		}
		return best?.id ?? null;
	}

	private contextualPing(point: THREE.Vector3): PingKind {
		const layout = (this.loadedWorld as LoadedWorld).layout;
		const near = (x: number, y: number, z: number, range: number) =>
			Math.hypot(point.x - x, point.y - y, point.z - z) < range;
		if (
			layout.altars.some((altar) => near(altar.x, altar.y + 0.8, altar.z, 2))
		) {
			return "altar";
		}
		const pickups = (this.loadedWorld as LoadedWorld).pickups;
		if (
			layout.pickups.some(
				(pickup) =>
					pickups.isAvailable(pickup.id) &&
					near(pickup.x, pickup.y, pickup.z, 1.4),
			)
		) {
			return "material";
		}
		if (
			layout.hideSpots.some((spot) => {
				const furniture = layout.furniture[spot.furnitureId];
				return (
					furniture &&
					near(
						furniture.x,
						furniture.y + furniture.height * 0.5,
						furniture.z,
						1.4,
					)
				);
			})
		) {
			return "hide";
		}
		return "here";
	}

	private sendPing(kind: PingKind | null): void {
		const loaded = this.loadedWorld as LoadedWorld;
		if (!this.pingAllowed()) {
			return;
		}
		if (!this.hasAllies && !this.soloPingNoted) {
			this.soloPingNoted = true;
			pushFeedback(currentMessages().party.ping.solo, "info");
		}
		loaded.camera.updateMatrixWorld(true);
		const eye = loaded.camera.getWorldPosition(new THREE.Vector3());
		const forward = loaded.camera.getWorldDirection(new THREE.Vector3());
		const point = this.aimPoint(eye, forward, PING_MAX_DISTANCE);
		const anomalyId = this.aimedAnomaly(eye, forward, point.distanceTo(eye));
		const anomaly =
			anomalyId === null ? null : loaded.anomalies.info(anomalyId);
		const target = anomaly ? anomaly.position : point;
		getSocket().emit("game:ping", {
			kind: kind ?? (anomaly ? "monster" : this.contextualPing(point)),
			x: target.x,
			y: target.y,
			z: target.z,
			anomalyId,
		});
	}

	private sendEmote(emote: EmoteId): void {
		const serverNow = clockSync.serverNow();
		const player = this.player;
		if (!player || serverNow < this.emoteReadyAt || this.hideSpot >= 0) {
			return;
		}
		this.emoteReadyAt = serverNow + EMOTE_COOLDOWN_MS;
		this.localEmote = {
			emote,
			startedAt: serverNow,
			until: serverNow + EMOTE_DURATION_MS[emote],
			yaw: player.yaw,
		};
		getSocket().emit("game:emote", { emote });
	}

	private pingAllowed(): boolean {
		const now = performance.now();
		while (
			this.pingTimes.length > 0 &&
			now - this.pingTimes[0] >= PING_BURST_WINDOW_MS
		) {
			this.pingTimes.shift();
		}
		const last = this.pingTimes[this.pingTimes.length - 1] ?? -Infinity;
		if (this.pingTimes.length >= PING_BURST || now - last < PING_COOLDOWN_MS) {
			pushFeedback(currentMessages().party.ping.wait, "info");
			soundBank.play("capture-fail", { volume: 0.25 });
			return false;
		}
		this.pingTimes.push(now);
		return true;
	}

	private get hasAllies(): boolean {
		if (this.init.config.mode === "possessed") {
			return true;
		}
		const self = this.init.players.find((entry) => entry.id === this.selfId);
		return (
			self?.team !== null &&
			self?.team !== undefined &&
			this.init.players.some(
				(entry) => entry.id !== this.selfId && entry.team === self.team,
			)
		);
	}

	private castPower(serverNow: number): void {
		const loaded = this.loadedWorld as LoadedWorld;
		if (serverNow < this.powerReadyAt) {
			soundBank.play("capture-fail", { volume: 0.3 });
			return;
		}
		loaded.camera.updateMatrixWorld(true);
		const eye = loaded.camera.getWorldPosition(new THREE.Vector3());
		const forward = loaded.camera.getWorldDirection(new THREE.Vector3());
		const altar = loaded.layout.altars.find(
			(candidate) =>
				Math.hypot(
					candidate.x - eye.x,
					candidate.y + 0.8 - eye.y,
					candidate.z - eye.z,
				) <=
				ALTAR_INTERACT_RANGE + 0.3,
		);
		const point = altar
			? new THREE.Vector3(altar.x, altar.y, altar.z)
			: this.aimPoint(eye, forward, POSSESSED_CALL_RANGE);
		const room = loaded.world.roomAt({ x: point.x, z: point.z }, point.y + 0.1);
		if (!altar && room) {
			point.y = room.floorY;
		}
		getSocket().emit("game:power", {
			altarId: altar?.id ?? -1,
			x: point.x,
			y: point.y,
			z: point.z,
		});
		this.powerReadyAt = serverNow + POSSESSED_POWER_COOLDOWN_MS;
		this.powerPendingUntil = serverNow + 2000;
	}

	private pendingRole: RoleInfo | null = null;

	handleRole(role: RoleInfo): void {
		const loaded = this.loadedWorld;
		if (!loaded) {
			this.pendingRole = role;
			return;
		}
		const fresh = loaded.state.role?.role !== role.role;
		loaded.state.role = role;
		if (fresh) {
			this.roleShownAt = performance.now();
			soundBank.play(role.role === "possessed" ? "dark-call" : "event-gong", {
				volume: 0.6,
			});
		}
	}

	private updateMarkers(
		dt: number,
		eye: THREE.Vector3,
		forward: THREE.Vector3,
		serverNow: number,
	): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const camera = loaded.camera;
		const party = currentMessages().party;
		const pings = loaded.state.activePings(serverNow);
		const look = (ping: PingClientState) => {
			const owner =
				ping.playerId === this.selfId
					? party.possessed.you
					: (loaded.state.players.get(ping.playerId)?.name ?? "");
			const distance = Math.round(
				eye.distanceTo(new THREE.Vector3(ping.x, ping.y, ping.z)),
			);
			return {
				label: party.ping.kinds[ping.kind],
				detail: `${owner} · ${party.ping.distance(distance)}`,
				color: hex(PING_COLORS[ping.kind]),
			};
		};
		this.pingViews?.update(dt, pings, serverNow, camera.fov, look);
		const markers: HudMarker[] = [];
		const projected = new THREE.Vector3();
		const live = new Set<number>();
		for (const ping of pings) {
			const point = new THREE.Vector3(ping.x, ping.y + 0.5, ping.z);
			const ahead = point.clone().sub(eye).normalize().dot(forward) > 0.05;
			projected.copy(point).project(camera);
			if (
				ahead &&
				Math.abs(projected.x) < 0.96 &&
				Math.abs(projected.y) < 0.94
			) {
				this.arrowAngles.delete(ping.id);
				continue;
			}
			live.add(ping.id);
			const sx = ahead ? projected.x : -projected.x;
			const sy = ahead ? projected.y : -projected.y;
			const target = Math.atan2(-sy, sx);
			const previous = this.arrowAngles.get(ping.id);
			const angle =
				previous === undefined
					? target
					: previous +
						Math.atan2(
							Math.sin(target - previous),
							Math.cos(target - previous),
						) *
							Math.min(1, dt * 16);
			this.arrowAngles.set(ping.id, angle);
			const details = look(ping);
			markers.push({
				x: 0,
				y: 0,
				onScreen: false,
				angle,
				label: details.label,
				detail: details.detail,
				color: details.color,
				fresh: (serverNow - ping.createdAt) / 700,
			});
		}
		for (const id of this.arrowAngles.keys()) {
			if (!live.has(id)) {
				this.arrowAngles.delete(id);
			}
		}
		loaded.hud.markers = markers;
	}

	private mapPings(): MapPoint[] {
		const loaded = this.loadedWorld as LoadedWorld;
		const top = Math.max(...loaded.layout.levels);
		return loaded.state.activePings(clockSync.serverNow()).map((ping) => ({
			x: ping.x,
			z: ping.z,
			level: levelForHeight(ping.y + 0.1, top, 1.8),
			color: hex(PING_COLORS[ping.kind]),
		}));
	}

	private mapThreats(): MapPoint[] {
		const loaded = this.loadedWorld as LoadedWorld;
		if (loaded.state.role?.role !== "possessed") {
			return [];
		}
		const top = Math.max(...loaded.layout.levels);
		return loaded.anomalies.infos().map((info) => ({
			x: info.position.x,
			z: info.position.z,
			level: levelForHeight(info.position.y + 0.1, top, 1.8),
			color: "#e5533d",
		}));
	}

	private updateStats(
		loaded: LoadedWorld,
		settings: ReturnType<typeof settingsStore.get>,
	): void {
		const now = performance.now();
		if (now - this.statsPublishedAt < 250) {
			return;
		}
		this.statsPublishedAt = now;
		const config = settings.stats;
		const enabled = Object.values(config.metrics).some(Boolean);
		if (!enabled && !config.graph) {
			this.stats = null;
			return;
		}
		const labels = currentMessages().party.stats;
		const lines: StatsLine[] = [];
		const add = (
			metric: keyof typeof config.metrics,
			value: string,
			warn = false,
		) => {
			if (config.metrics[metric]) {
				lines.push({ label: labels.short[metric], value, warn });
			}
		};
		const frames = this.frameTimes;
		const average =
			frames.reduce((sum, value) => sum + value, 0) /
			Math.max(1, frames.length);
		const worst = frames.length > 0 ? Math.max(...frames) : 0;
		add("fps", String(this.fps), this.fps > 0 && this.fps < 30);
		add("frameTime", labels.frameTime(average, worst), worst > 50);
		add(
			"ping",
			labels.milliseconds(Math.round(clockSync.roundTrip)),
			clockSync.roundTrip > 150,
		);
		add(
			"jitter",
			labels.milliseconds(Math.round(clockSync.jitter)),
			clockSync.jitter > 30,
		);
		const recent = this.snapshotArrivals.filter(
			(arrival) => now - arrival.at <= 1000,
		);
		add("snapshots", labels.perSecond(recent.length));
		const window = this.snapshotArrivals.filter(
			(arrival) => now - arrival.at <= 3000,
		);
		let loss = 0;
		if (window.length > 1) {
			const span =
				(window[window.length - 1].tick - window[0].tick) /
					SNAPSHOT_INTERVAL_TICKS +
				1;
			loss = Math.max(0, Math.round((1 - window.length / span) * 100));
		}
		add("loss", labels.percent(loss), loss >= 5);
		add(
			"interpolation",
			labels.milliseconds(Math.round(this.interpolationDelay)),
		);
		const info = loaded.renderer.info.render;
		add("drawCalls", labels.thousands(info.calls));
		add("triangles", labels.thousands(info.triangles));
		const memory = (
			performance as Performance & { memory?: { usedJSHeapSize: number } }
		).memory;
		add(
			"memory",
			memory
				? labels.megabytes(Math.round(memory.usedJSHeapSize / 1048576))
				: labels.unavailable,
		);
		const peers = Object.values(voiceStore.get().peers);
		const connected = peers.filter(
			(peer) => peer.state === "connected" || peer.relayed,
		).length;
		add(
			"voice",
			labels.voice(
				connected,
				peers.length,
				peers.filter((peer) => peer.relayed).length,
			),
			connected < peers.length,
		);
		this.stats = {
			lines,
			frames: config.graph ? [...frames] : [],
		};
	}

	private updateAudio(
		dt: number,
		eye: THREE.Vector3,
		forward: THREE.Vector3,
		player: LocalPlayer,
		spotted: number,
		serverNow: number,
		flags: number,
	): void {
		const loaded = this.loadedWorld as LoadedWorld;
		audioEngine.setListener({
			x: eye.x,
			y: eye.y,
			z: eye.z,
			forwardX: forward.x,
			forwardY: forward.y,
			forwardZ: forward.z,
		});
		const room = loaded.world.roomAt(
			{ x: player.character.x, z: player.character.z },
			player.character.y,
		);
		const jets = loaded.hazards.activeJets(serverNow);
		const nearestJet =
			jets
				.map((jet) => jet.position)
				.sort((a, b) => a.distanceTo(eye) - b.distanceTo(eye))[0] ?? null;
		const self = loaded.state.self?.latest;
		loaded.ambientAudio.update(dt, eye, room, {
			stepSpeed:
				this.hideSpot >= 0 ||
				this.carriedBy !== null ||
				(flags & PLAYER_FLAG.dead) !== 0
					? 0
					: player.speed,
			grounded: player.character.grounded,
			crouching: player.character.crouch > 0.5,
			slimed: (flags & PLAYER_FLAG.slimed) !== 0,
			wading: this.selfLiquid !== null,
			tension: spotted,
			lowHealth: (self?.hp ?? 100) < 30 && (flags & PLAYER_FLAG.dead) === 0,
			waterAt:
				nearestJet && nearestJet.distanceTo(eye) < 18 ? nearestJet : null,
		});
	}

	private sampleVoice(dt: number): void {
		const level = micManager.measure();
		this.voicePeak = Math.max(this.voicePeak, level);
		if (level >= CAPTURE_VOICE_ACTIVITY_LEVEL) {
			this.voiceActiveMs += dt * 1000;
		}
	}

	private sendState(serverNow: number, player: LocalPlayer): void {
		if (serverNow - this.lastSendAt < CLIENT_STATE_INTERVAL_MS) {
			return;
		}
		this.lastSendAt = serverNow;
		this.seq += 1;
		const character = player.character;
		const input = player.lastInput;
		getSocket().emit("game:state", {
			seq: this.seq,
			x: character.x,
			y: character.y,
			z: character.z,
			yaw: this.localEmote?.yaw ?? player.yaw,
			pitch: player.pitch,
			vx: character.vx,
			vy: character.vy,
			vz: character.vz,
			grounded: character.grounded,
			crouch: character.crouch,
			sprint: input.sprint,
			moveInput: Math.abs(input.forward) > 0 || Math.abs(input.strafe) > 0,
			grimoire: (this.loadedWorld as LoadedWorld).grimoire.isOpen,
			camera: this.cameraUp,
			voiceLevel: Math.min(1, this.voicePeak),
			voicePeakMs: Math.min(2000, Math.round(this.voiceActiveMs)),
			held: this.heldSlot,
			moveAck: player.moveAck,
			jumps: player.jumps,
		});
		this.voicePeak = 0;
		this.voiceActiveMs = 0;
	}

	private anomalyLabel(anomalyId: number): string | null {
		const entry = this.init.roster.find(
			(candidate) => candidate.id === anomalyId,
		);
		if (!entry) {
			return null;
		}
		const suffix =
			entry.exemplarCount > 1 ? ` ${romanNumeral(entry.exemplar)}` : "";
		return `${currentMessages().grimoire.species[entry.species].name}${suffix}`;
	}

	private updateHaze(dt: number, eye: THREE.Vector3): void {
		const { scene } = this.loadedWorld as LoadedWorld;
		const fog = scene.fog;
		if (!(fog instanceof THREE.FogExp2)) {
			return;
		}
		this.clearAir ??= { density: fog.density, color: fog.color.clone() };
		let wanted = 0;
		for (const info of (this.loadedWorld as LoadedWorld).anomalies.infos()) {
			if (info.species !== "brume" || info.targetId !== this.selfId) {
				continue;
			}
			const near =
				1 -
				THREE.MathUtils.smoothstep(
					info.center.distanceTo(eye),
					HAZE_NEAR,
					HAZE_FAR,
				);
			wanted = Math.max(wanted, info.extra * near);
		}
		const event = (this.loadedWorld as LoadedWorld).state.manorEvent;
		const serverNow = clockSync.serverNow();
		if (
			event?.kind === "thickFog" &&
			event.phase === "start" &&
			serverNow >= event.startsAt &&
			serverNow < event.endsAt
		) {
			wanted = Math.max(wanted, 0.85);
		}
		const rate = (wanted > this.haze ? 0.9 : 0.45) * dt;
		this.haze += THREE.MathUtils.clamp(wanted - this.haze, -rate, rate);
		const amount = this.haze * this.haze * (3 - 2 * this.haze);
		fog.density = THREE.MathUtils.lerp(
			this.clearAir.density,
			HAZE_DENSITY,
			amount,
		);
		fog.color.lerpColors(this.clearAir.color, this.hazeColor, amount);
		const shown = hudStore.get().haze;
		if (Math.abs(shown - amount) > 0.02 || (amount === 0 && shown !== 0)) {
			hudStore.set({ haze: amount });
		}
		if (scene.background instanceof THREE.Color) {
			scene.background.copy(fog.color);
		}
	}

	private updateGorgonGaze(
		dt: number,
		eye: THREE.Vector3,
		player: LocalPlayer,
	): number {
		const loaded = this.loadedWorld as LoadedWorld;
		let highest = 0;
		for (const info of loaded.anomalies.infos()) {
			if (info.species !== "gorgone") {
				continue;
			}
			const enraged =
				info.state === "special" ||
				info.state === "chase" ||
				info.state === "windup";
			if (enraged) {
				this.gorgonGaze.set(info.id, 0);
				if (info.targetId === this.selfId) {
					highest = 1;
				}
				continue;
			}
			const looking =
				this.hideSpot < 0 &&
				isGazingAt(loaded.world, eye, player.yaw, player.pitch, info.center);
			const current = this.gorgonGaze.get(info.id) ?? 0;
			const next = looking
				? current + dt * 1000
				: Math.max(0, current - dt * 1000 * GORGON_GAZE_DECAY);
			this.gorgonGaze.set(info.id, next);
			highest = Math.max(highest, next / GORGON_GAZE_LIMIT_MS);
		}
		return Math.min(1, highest);
	}

	private currentLevel(): Level {
		const player = this.player;
		const layout = this.loadedWorld?.layout;
		if (!player || !layout) {
			return 0;
		}
		return levelForHeight(player.character.y, Math.max(...layout.levels), 1.8);
	}

	private isOnRadio(playerId: string, flags: number): boolean {
		if (playerId === this.selfId) {
			return this.radioOn && micManager.voiceActive();
		}
		return (
			(flags & PLAYER_FLAG.radio) !== 0 &&
			voiceChat.levelOf(playerId) > RADIO_TALKING_LEVEL
		);
	}

	private walkieSpeakers(): string[] {
		const loaded = this.loadedWorld as LoadedWorld;
		const speakers = [...loaded.remotePlayers.radioSpeakers];
		if (
			this.radioGhostName &&
			performance.now() < this.radioGhostUntil &&
			!speakers.includes(this.radioGhostName)
		) {
			speakers.push(this.radioGhostName);
		}
		return speakers;
	}

	private leaderboardRows(): LeaderboardRow[] {
		const loaded = this.loadedWorld as LoadedWorld;
		const holders = new Set(
			[...loaded.state.walkies.values()].map((walkie) => walkie.holder),
		);
		const taglines = new Map(
			this.init.players.map((player) => [player.id, player.tagline]),
		);
		return [...loaded.state.players.values()]
			.map((player) => ({
				id: player.id,
				name: player.name,
				color: player.color,
				score: player.latest?.score ?? 0,
				health: player.latest?.hp ?? 100,
				energy: player.latest?.en ?? 100,
				alive: player.latest
					? (player.latest.flags & PLAYER_FLAG.dead) === 0
					: true,
				self: player.id === this.selfId,
				team: player.team,
				walkie: holders.has(player.id),
				radio: this.isOnRadio(player.id, player.latest?.flags ?? 0),
				tagline: taglines.get(player.id) ?? null,
				bounty: loaded.state.bounty.playerId === player.id,
				voted: loaded.state.voters.has(player.id),
			}))
			.sort((first, second) => second.score - first.score);
	}

	private publishHud(
		serverNow: number,
		spotted: number,
		flags: number,
		health: number,
		energy: number,
	): void {
		const now = performance.now();
		if (now - this.hudPublishedAt < HUD_INTERVAL_MS) {
			return;
		}
		this.hudPublishedAt = now;
		const loaded = this.loadedWorld as LoadedWorld;
		const startedAt = this.beginInfo?.startedAt ?? serverNow;
		const howlerNearby = this.howlerNearby(serverNow);
		const respawnAt = this.respawnAt;
		hudStore.set({
			leaderboard: this.leaderboardHeld ? this.leaderboardRows() : [],
			remainingMs: this.beginInfo
				? Math.max(0, this.beginInfo.endsAt - serverNow)
				: loaded.state.remainingMs,
			anomaliesInMs: Math.max(
				0,
				startedAt + this.init.anomalySpawnDelayMs - serverNow,
			),
			health,
			energy,
			sprintLocked: (flags & PLAYER_FLAG.sprintLocked) !== 0,
			lanternOpen: this.lanternIntent,
			crouching: (this.player?.character.crouch ?? 0) > 0.5,
			prompt:
				this.altarId !== null
					? this.altarPrompt()
					: (this.interaction?.label ?? null),
			dead: (flags & PLAYER_FLAG.dead) !== 0,
			respawnAt,
			hidden: this.hideSpot >= 0,
			carried: this.carriedBy !== null,
			spotted,
			gaze: this.gaze,
			howlerNearby,
			slimed: (flags & PLAYER_FLAG.slimed) !== 0,
			damageAt: this.selfDamageAt.value,
			protectedUntil:
				(flags & PLAYER_FLAG.protected) !== 0 ? serverNow + 500 : 0,
			pushReadyAt: this.pushReadyAt,
			shoutReadyAt: this.shoutReadyAt,
			voiceLevel: micManager.measure(),
			voiceTransmitting: micManager.voiceActive(),
			fps: this.fps,
			walkieHeld: loaded.state.selfHasWalkie,
			walkieTalking: this.radioOn,
			walkieSpeakers: this.walkieSpeakers(),
			cameraHeld: loaded.state.selfHasCamera,
			cameraRaised: this.cameraUp,
			cameraAiming: this.cameraAiming,
			photoCount: photoStore.get().photos.length,
			...this.brewHud((flags & PLAYER_FLAG.dead) === 0),
			level: this.currentLevel(),
			serverNow,
			...this.partyHud(flags),
		});
	}

	private partyHud(flags: number) {
		const loaded = this.loadedWorld as LoadedWorld;
		const state = loaded.state;
		const party = currentMessages().party;
		const wheel = this.wheel;
		const bountyHolder = state.bounty.playerId
			? state.players.get(state.bounty.playerId)
			: undefined;
		return {
			ghost: (flags & PLAYER_FLAG.dead) !== 0 && this.ghostLimits !== null,
			oneLife: hasMutator(this.init.config, "oneLife"),
			ghostDoorReadyAt: this.ghostDoorReadyAt,
			ghostKnockReadyAt: this.ghostKnockReadyAt,
			wheel: wheel
				? wheel.kind === "ping"
					? {
							title: party.ping.wheel,
							labels: PING_WHEEL.map((kind) => party.ping.kinds[kind]),
							colors: PING_WHEEL.map((kind) => hex(PING_COLORS[kind])),
							selected: wheel.selected,
						}
					: {
							title: party.emote.wheel,
							labels: EMOTE_IDS.map((emote) => party.emote.names[emote]),
							colors: EMOTE_IDS.map(() => "#dce54d"),
							selected: wheel.selected,
						}
				: null,
			gift: this.gift
				? { name: this.gift.name, selected: this.gift.selected }
				: null,
			manorEvent: state.manorEvent,
			bounty:
				bountyHolder && state.bounty.value > 0
					? {
							name: bountyHolder.name,
							value: state.bounty.value,
							self: bountyHolder.id === this.selfId,
						}
					: null,
			ritual: state.ritual,
			role: state.role?.role ?? null,
			roleShownAt: this.roleShownAt,
			powerReadyAt: this.powerReadyAt,
			noMap: this.noMap,
			voting: this.voting,
			stats: this.stats,
			pushCooldownMs: this.pushCooldownMs,
		};
	}

	private respawnAt = 0;

	private howlerNearby(serverNow: number): boolean {
		const loaded = this.loadedWorld as LoadedWorld;
		const eye = loaded.camera.position;
		for (const anomaly of loaded.state.anomalies.values()) {
			if (
				anomaly.active &&
				anomaly.roster.species === "hurleur" &&
				anomaly.screamUntil > serverNow
			) {
				const info = loaded.anomalies.info(anomaly.id);
				if (info && info.center.distanceTo(eye) < 7.5) {
					return true;
				}
			}
		}
		return false;
	}

	private drawMinimap(player: LocalPlayer): void {
		const renderer = this.mapRenderer;
		const { hud } = this.loadedWorld as LoadedWorld;
		const context = hud.minimap.getContext("2d");
		const roomId = this.currentRoomId(player);
		const room = roomId === null ? null : this.layout?.rooms[roomId];
		hud.minimapRoom = room ? roomLabel(room) : "";
		hud.minimapLabel = currentMessages().game.map.levelName(
			this.currentLevel(),
		);
		if (!context || !renderer || this.noMap) {
			return;
		}
		const view = {
			centerX: player.character.x,
			centerZ: player.character.z,
			scale: 8,
			width: MINIMAP_SIZE,
			height: MINIMAP_SIZE,
			level: this.currentLevel(),
		};
		const options = {
			labels: false,
			labelSize: 0,
			grid: false,
			compass: false,
			scaleBar: false,
			player: {
				x: player.character.x,
				z: player.character.z,
				yaw: player.yaw,
			},
			others: this.mapMarkers(),
			names: false,
			pinToEdge: true,
			currentRoomId: roomId,
			levelBadge: null,
			pixelRatio: hud.minimapRatio(),
			silhouette: true,
			pings: this.mapPings(),
			threats: this.mapThreats(),
			cached: true,
		};
		const key = JSON.stringify([view, options]);
		if (key === this.minimapKey) {
			return;
		}
		this.minimapKey = key;
		renderer.draw(context, view, options);
		hud.markMinimap();
	}

	private mapMarkers(): MapMarker[] {
		const loaded = this.loadedWorld;
		if (!loaded) {
			return [];
		}
		const top = Math.max(...loaded.layout.levels);
		const markers: MapMarker[] = [];
		const disguises = loaded.anomalies.disguises();
		const viewer = this.player?.character;
		const now = performance.now();
		for (const player of loaded.state.players.values()) {
			const latest = player.latest;
			if (player.id === loaded.state.selfId || !latest) {
				continue;
			}
			const dead = (latest.flags & PLAYER_FLAG.dead) !== 0;
			const corpse =
				dead && !(this.ghostLimits !== null && loaded.state.selfDead)
					? loaded.remotePlayers.corpseOf(player.id)
					: null;
			const body = corpse
				? { x: corpse.x, y: corpse.y, z: corpse.z, yaw: latest.yaw }
				: viewer
					? this.markerBlender.place(
							player.id,
							viewer,
							latest,
							disguises,
							now,
							dead,
						)
					: latest;
			const color =
				player.team === null ? player.color : TEAM_COLORS[player.team];
			markers.push({
				x: body.x,
				z: body.z,
				yaw: body.yaw,
				level: levelForHeight(body.y, top, 1.8),
				color: `#${color.toString(16).padStart(6, "0")}`,
				name: player.name,
				dead,
			});
		}
		return markers;
	}

	private currentRoomId(player: LocalPlayer): number | null {
		const loaded = this.loadedWorld;
		if (!loaded) {
			return null;
		}
		return (
			loaded.world.roomAt(
				{ x: player.character.x, z: player.character.z },
				player.character.y + 0.1,
			)?.id ?? null
		);
	}

	private drawBigMap(player: LocalPlayer, hud: LoadedWorld["hud"]): void {
		const renderer = this.mapRenderer;
		const context = hud.bigMap.getContext("2d");
		if (!renderer || !context) {
			return;
		}
		const area = hud.mapArea();
		const state = mapStore.get();
		const fit = renderer.fitView(area.width, area.height, state.level);
		const view = {
			...fit,
			scale: fit.scale * state.zoom,
			centerX: fit.centerX + state.panX,
			centerZ: fit.centerZ + state.panZ,
		};
		this.mapScale = view.scale;
		const showPlayer = this.currentLevel() === state.level;
		renderer.draw(context, view, {
			labels: true,
			labelSize: Math.min(28, 18 + view.scale * 0.6),
			grid: true,
			compass: true,
			scaleBar: true,
			player: showPlayer
				? { x: player.character.x, z: player.character.z, yaw: player.yaw }
				: null,
			others: this.mapMarkers(),
			names: true,
			pinToEdge: false,
			currentRoomId: showPlayer ? this.currentRoomId(player) : null,
			levelBadge: null,
			pixelRatio: area.ratio,
			silhouette: false,
			pings: this.mapPings(),
			threats: this.mapThreats(),
		});
	}

	private render(loaded: LoadedWorld): void {
		const { renderer, scene, camera, rig } = loaded;
		renderer.clear();
		camera.layers.set(0);
		renderer.render(scene, camera);
		if (!rig.root.visible) {
			return;
		}
		renderer.clearDepth();
		camera.layers.set(FIRST_PERSON_LAYER);
		renderer.render(rig.root, camera);
		camera.layers.set(0);
	}

	private updateRadioGhost(): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const now = performance.now();
		if (!loaded.state.selfHasWalkie || now < this.radioGhostAt) {
			if (!loaded.state.selfHasWalkie) {
				this.radioGhostAt =
					now + RADIO_GHOST_MIN_MS + Math.random() * RADIO_GHOST_EXTRA_MS;
			}
			return;
		}
		this.radioGhostAt =
			now + RADIO_GHOST_MIN_MS + Math.random() * RADIO_GHOST_EXTRA_MS;
		const body = loaded.anomalies
			.disguises()
			.find((disguise) => disguise.playerId !== this.selfId);
		const clip = body ? doubleVoices.clipFor(body.playerId) : null;
		if (body && clip) {
			speakRadioClip(clip);
			soundBank.play("radio-squelch", { volume: 0.5 });
			this.radioGhostName =
				loaded.state.players.get(body.playerId)?.name ?? null;
			this.radioGhostUntil = now + clip.duration * 1000;
		}
	}

	playHighlights(highlights: Highlight[], onDone: () => void): boolean {
		const loaded = this.loadedWorld;
		if (!loaded || !this.container || highlights.length === 0) {
			return false;
		}
		const replay = new ReplayDirector(loaded, highlights);
		this.closeMap();
		loaded.grimoire.setOpen(false);
		loaded.anomalies.silenceVoices();
		momentVoices.stopCapture();
		loaded.remotePlayers.spectate();
		this.pingViews?.clear();
		loaded.hud.markers = [];
		voiceChat.clearRadio();
		voiceChat.setMode("lobby");
		this.cast.cancel();
		this.input?.releasePointerLock();
		this.input?.detach();
		this.input = null;
		loaded.post.clearHud();
		loaded.rig.root.visible = false;
		loaded.body.root.visible = false;
		loaded.camera.fov = REPLAY_FOV;
		loaded.camera.updateProjectionMatrix();
		const fog = loaded.scene.fog;
		if (fog instanceof THREE.FogExp2 && this.clearAir) {
			fog.density = this.clearAir.density;
			fog.color.copy(this.clearAir.color);
		}
		hudStore.set({ showMap: false, showLeaderboard: false, paused: false });
		this.onReplayDone = onDone;
		if (!replay.next()) {
			return false;
		}
		this.replay = replay;
		return true;
	}

	skipHighlight(): void {
		if (this.replay && !this.replay.next()) {
			this.finishReplay();
		}
	}

	skipAllHighlights(): void {
		if (this.replay) {
			this.finishReplay();
		}
	}

	private finishReplay(): void {
		this.replay?.stop();
		this.replay = null;
		momentVoices.clear();
		replayStore.set({ active: false });
		const done = this.onReplayDone;
		this.onReplayDone = null;
		done?.();
	}

	private stepReplay(dt: number): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const time = (this.replay as ReplayDirector).advance(dt);
		if (time === null) {
			this.finishReplay();
			return;
		}
		const settings = settingsStore.get();
		loaded.camera.updateMatrixWorld(true);
		const eye = loaded.camera.getWorldPosition(new THREE.Vector3());
		const forward = loaded.camera.getWorldDirection(new THREE.Vector3());
		this.dynamicLights.length = 0;
		loaded.remotePlayers.update(dt, time, eye, eye, this.dynamicLights);
		loaded.anomalies.update(dt, time, eye, this.dynamicLights);
		loaded.anomalies.resonate(null, eye, dt);
		loaded.doors.update(dt);
		loaded.hazards.update(dt, time, this.dynamicLights);
		loaded.decor.update(dt, eye);
		loaded.particles.update(dt);
		loaded.motes.update(dt, eye);
		loaded.pickups.update(dt, eye);
		loaded.altars.update(dt, eye);
		loaded.walkies.update(dt, eye, this.dynamicLights);
		loaded.cameras.update(dt, eye, this.dynamicLights);
		loaded.stakes.update(dt, eye, time, this.dynamicLights);
		loaded.lights.update(eye, this.dynamicLights, dt);
		this.cullRooms(eye);
		audioEngine.setListener({
			x: eye.x,
			y: eye.y,
			z: eye.z,
			forwardX: forward.x,
			forwardY: forward.y,
			forwardZ: forward.z,
		});
		loaded.post.render(
			{
				dt,
				effects: settings.postEffects,
				tension: 0,
				animated: !settings.reduceMotion,
				colorLevels: settings.colorLevels,
				desaturate: 0,
			},
			() => this.render(loaded),
		);
	}

	private bountySeen: string | null = null;

	private startVote(endsAt: number, reason: "ritual" | "timeout"): void {
		const loaded = this.loadedWorld as LoadedWorld;
		if (this.voting) {
			voteStore.set({ endsAt, reason });
			return;
		}
		this.voting = true;
		this.closeMap();
		loaded.grimoire.setOpen(false);
		this.cast.cancel();
		this.closeWheel();
		this.gift = null;
		this.setAltar(null);
		if (this.radioOn) {
			this.radioOn = false;
			getSocket().emit("game:radio", { on: false });
		}
		voiceChat.clearRadio();
		voiceChat.setMode("lobby");
		loaded.remotePlayers.voiceOpen = true;
		this.intentionalUnlock = true;
		this.input?.releasePointerLock();
		hudStore.set({ paused: false, showMap: false, showLeaderboard: false });
		voteStore.set({
			open: true,
			endsAt,
			reason,
			choice: null,
			candidates: [...loaded.state.players.values()].map((player) => ({
				id: player.id,
				name: player.name,
				color: player.color,
				self: player.id === this.selfId,
				voted: loaded.state.voters.has(player.id),
			})),
		});
		soundBank.play("event-gong", { volume: 0.8 });
		if (reason === "ritual") {
			pushFeedback(currentMessages().party.possessed.quotaReached, "success");
		}
	}

	private onPartyEvent(event: GameEvent): void {
		const loaded = this.loadedWorld as LoadedWorld;
		const party = currentMessages().party;
		const nameOf = (id: string) => loaded.state.players.get(id)?.name ?? "?";
		const serverNow = clockSync.serverNow();
		switch (event.type) {
			case "ping":
				soundBank.play(
					event.kind === "danger" || event.kind === "monster"
						? "ping-danger"
						: "ping",
					{ volume: 0.45 },
				);
				break;
			case "gift": {
				const material = currentMessages().grimoire.materials[event.material];
				if (event.toId === this.selfId) {
					soundBank.play("gift", { volume: 0.7 });
					pushFeedback(
						party.gift.received(material, nameOf(event.fromId)),
						"success",
					);
				} else if (event.fromId === this.selfId) {
					soundBank.play("gift", { volume: 0.4, rate: 0.8 });
					pushFeedback(party.gift.given(material, nameOf(event.toId)), "info");
				}
				break;
			}
			case "poltergeist":
				soundBank.play("poltergeist", {
					position: { x: event.x, y: event.y + 1, z: event.z },
					volume: 1,
					refDistance: 3,
					maxDistance: 32,
				});
				break;
			case "manorEvent": {
				const name = party.events.names[event.kind];
				if (event.phase === "warning") {
					soundBank.play("event-gong", { volume: 0.35, rate: 1.4 });
				} else if (event.phase === "start") {
					soundBank.play("event-gong", { volume: 0.9 });
					pushFeedback(
						party.events.started(name, party.events.descriptions[event.kind]),
						"warning",
					);
				} else {
					pushFeedback(party.events.ended(name), "info");
				}
				break;
			}
			case "bounty":
				if (event.playerId !== this.bountySeen) {
					this.bountySeen = event.playerId;
					if (event.playerId === this.selfId) {
						soundBank.play("bounty", { volume: 0.6 });
						pushFeedback(party.bounty.you(event.value), "warning");
					} else if (event.playerId) {
						pushFeedback(
							party.bounty.other(nameOf(event.playerId), event.value),
							"info",
						);
					}
				}
				break;
			case "bountyReward":
				if (event.playerId === this.selfId) {
					soundBank.play("bounty", { volume: 0.8 });
					pushFeedback(
						event.reason === "push"
							? party.bounty.pushReward(event.points, nameOf(event.targetId))
							: party.bounty.claimed(
									nameOf(event.playerId),
									event.points,
									nameOf(event.targetId),
								),
						"success",
					);
				} else if (event.reason === "claim") {
					pushFeedback(
						party.bounty.claimed(
							nameOf(event.playerId),
							event.points,
							nameOf(event.targetId),
						),
						"info",
					);
				}
				break;
			case "altarCurse": {
				const altar = loaded.layout.altars[event.altarId];
				if (altar) {
					soundBank.play("dark-call", {
						position: { x: altar.x, y: altar.y + 1, z: altar.z },
						volume: 0.8,
						refDistance: 3,
						maxDistance: 24,
					});
				}
				if (serverNow < this.powerPendingUntil) {
					this.powerPendingUntil = 0;
					pushFeedback(party.possessed.curseDone, "success");
				}
				break;
			}
			case "darkCall":
				soundBank.play("dark-call", {
					position: { x: event.x, y: event.y + 1, z: event.z },
					volume: 1,
					refDistance: 4,
					maxDistance: 45,
				});
				if (serverNow < this.powerPendingUntil) {
					this.powerPendingUntil = 0;
					pushFeedback(party.possessed.callDone, "success");
				}
				break;
			case "vote":
				if (event.phase === "start") {
					this.startVote(event.endsAt, event.reason);
				}
				break;
			case "voteCast":
				voteStore.set((state) => ({
					candidates: state.candidates.map((candidate) =>
						candidate.id === event.voterId
							? { ...candidate, voted: true }
							: candidate,
					),
				}));
				break;
			default:
				break;
		}
	}

	private onEvent(event: GameEvent): void {
		const loaded = this.loadedWorld as LoadedWorld;
		this.onPartyEvent(event);
		switch (event.type) {
			case "voiceWindows":
				momentVoices.setWindows(event.windows);
				break;
			case "walkie":
				loaded.walkies.setAvailable(event.id, event.available);
				if (event.holder === this.selfId) {
					soundBank.play("radio-squelch", { volume: 0.6 });
					pushFeedback(currentMessages().game.walkie.taken, "info");
				}
				break;
			case "brew":
				if (event.playerId === this.selfId && event.effect) {
					soundBank.play("brew-gulp", { volume: 0.8 });
				}
				break;
			case "camera":
				loaded.cameras.setAvailable(event.id, event.available);
				if (event.holder === this.selfId) {
					soundBank.play("camera-shutter", { volume: 0.35 });
					pushFeedback(
						currentMessages().game.camera.taken(
							keyLabel(settingsStore.get().keys.aim),
							keyLabel(settingsStore.get().keys.camera),
						),
						"info",
					);
				}
				break;
			case "stake": {
				const stake = loaded.layout.stakes[event.id];
				if (stake && event.playerId !== null) {
					soundBank.play(stake.kind === "pact" ? "stake-pact" : "stake-bell", {
						position: { x: stake.x, y: stake.y + 1, z: stake.z },
						volume: 1,
						refDistance: 6,
						maxDistance: stake.kind === "pact" ? 16 : 60,
					});
				}
				if (stake && event.playerId === this.selfId) {
					pushFeedback(
						currentMessages().game.stakeResult[stake.kind],
						stake.kind === "sanctuary" ? "success" : "warning",
					);
				}
				break;
			}
			case "door": {
				const door = loaded.doors.doors.get(event.doorId);
				if (
					door &&
					(door.predictedUntil < clockSync.serverNow() ||
						event.by !== this.selfId)
				) {
					loaded.doors.setOpen(event.doorId, event.open);
				} else if (door) {
					door.predictedUntil = 0;
					loaded.doors.setOpen(event.doorId, event.open);
				}
				if (door) {
					const position = new THREE.Vector3(
						door.geometry.center.x,
						door.geometry.floorY + 1.1,
						door.geometry.center.z,
					);
					soundBank.play(event.open ? "door-creak" : "door-shut", {
						position,
						refDistance: 2,
						maxDistance: 28,
					});
				}
				break;
			}
			case "pickup":
				loaded.pickups.setTaken(event.id, true);
				if (event.playerId === this.selfId) {
					soundBank.play("page-turn", { volume: 0.5, rate: 1.5 });
				}
				break;
			case "pickupBack": {
				const pickup = loaded.layout.pickups[event.id];
				if (pickup && pickup.material !== event.material) {
					pickup.material = event.material;
					loaded.pickups.setMaterial(event.id, event.material);
				}
				loaded.pickups.setTaken(event.id, false);
				break;
			}
			case "craft": {
				const altar = loaded.layout.altars[event.altarId];
				if (event.playerId === this.selfId) {
					this.setAltar(null);
				}
				if (altar) {
					soundBank.play("capture", { position: altar, volume: 0.5 });
				}
				break;
			}
			case "valve": {
				const valve = loaded.layout.valves[event.valveId];
				if (valve) {
					soundBank.play("valve-turn", { position: valve.valve });
				}
				break;
			}
			case "damage":
				if (event.playerId === this.selfId) {
					if (event.periodic) {
						soundBank.play("hurt", { volume: 0.25, rate: 1.25 });
					} else {
						this.selfDamageAt.value = performance.now();
						soundBank.play("hurt", { volume: 0.8 });
					}
				}
				break;
			case "death":
				if (event.playerId === this.selfId) {
					this.cancelEmote(false);
					this.respawnAt = event.respawnAt;
					this.cast.cancel();
					loaded.grimoire.setOpen(false);
					this.carriedBy = null;
					this.hideSpot = -1;
					soundBank.play("death", { volume: 0.9 });
					if (event.fragmentsLost > 0) {
						pushFeedback(
							currentMessages().game.fragmentsLost(event.fragmentsLost),
							"warning",
						);
					}
				}
				break;
			case "respawn":
				if (event.playerId === this.selfId) {
					this.respawnAt = 0;
					soundBank.play("respawn", { volume: 0.7 });
					this.lanternIntent = false;
				}
				break;
			case "carry":
				if (event.playerId === this.selfId) {
					this.carriedBy = event.active ? event.anomalyId : null;
					if (event.active) {
						this.cast.cancel();
						loaded.grimoire.setOpen(false);
						this.lanternIntent = false;
					}
				}
				break;
			case "castInterrupted":
				if (event.playerId === this.selfId) {
					this.cast.interrupted();
				}
				break;
			case "shout": {
				if (event.playerId !== this.selfId) {
					soundBank.play("shout", {
						position: { x: event.x, y: event.y + 1.5, z: event.z },
						volume: 1.2,
						refDistance: 3,
					});
				} else {
					soundBank.play("shout", { volume: 0.8 });
				}
				break;
			}
			case "extractWarning":
				if (event.playerId === this.selfId) {
					soundBank.play("door-creak", { volume: 1, rate: 0.6 });
				}
				break;
			case "explosion":
				if (event.killed.includes(this.selfId)) {
					this.selfDamageAt.value = performance.now();
				}
				break;
			default:
				break;
		}
	}

	dispose(): void {
		this.tutorial?.dispose();
		this.tutorial = null;
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.stopDevModes();
		releaseKeyboardLock();
		this.detach();
		this.cast.dispose();
		resetVote();
		doubleVoices.clear();
		this.replay?.stop();
		this.replay = null;
		momentVoices.clear();
		voiceChat.clearRadio();
		voiceChat.setMode("lobby");
		soundBank.stopAll();
		if (this.loadedWorld) {
			this.disposeWorld(this.loadedWorld);
			this.loadedWorld = null;
		}
	}

	private disposeWorld(loaded: LoadedWorld): void {
		this.pingViews?.dispose();
		this.pingViews = null;
		loaded.ambientAudio.dispose();
		loaded.anomalies.dispose();
		loaded.remotePlayers.dispose();
		loaded.hazards.dispose();
		loaded.pickups.dispose();
		loaded.hud.dispose();
		loaded.altars.dispose();
		loaded.walkies.dispose();
		loaded.cameras.dispose();
		loaded.photoCamera.dispose();
		loaded.stakes.dispose();
		loaded.particles.dispose();
		loaded.motes.dispose();
		loaded.grimoire.dispose();
		loaded.rig.dispose();
		loaded.body.dispose();
		loaded.lights.dispose(loaded.scene);
		loaded.scene.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}
		});
		loaded.materials.dispose();
		loaded.rigMaterials.dispose();
		loaded.textures.dispose();
		loaded.post.dispose();
		loaded.renderer.dispose();
		loaded.renderer.forceContextLoss();
		loaded.renderer.domElement.remove();
	}
}
