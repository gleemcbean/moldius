import { entryWon, type MatchMetrics } from "../../shared/challenges.js";
import {
	ANOMALY_FIRST_SPAWN_DELAY_MS,
	ANOMALY_NEXT_DELAY_MS,
	ANOMALY_RETURN_DELAY_MS,
	ANOMALY_SPAWN_RETRY_MS,
	anomalyRosterSize,
	anomalyTierCaps,
	cameraCount,
	DOOR_INTERACT_RANGE,
	ENERGY_MAX,
	ENERGY_USE_REGEN_PAUSE_SECONDS,
	HEALTH_MAX,
	HIDE_INTERACT_RANGE,
	LANTERN_MIN_ENERGY_TO_OPEN,
	LANTERN_OPEN_ENERGY_COST,
	MATCH_LOADING_TIMEOUT_MS,
	OCCULT_CONSUMED_ON_CAPTURE,
	OCCULT_RECIPES,
	type OccultId,
	PLAYER_DAMAGE_INTERVAL_MS,
	PLAYER_RESPAWN_DELAY_MS,
	PLAYER_RESPAWN_PROTECTION_MS,
	PLAYER_SPAWN_PROTECTION_MS,
	RECONNECT_GRACE_MS,
	SERVER_TICK_MS,
	SLIME_PUDDLE_DAMAGE,
	SLIME_PUDDLE_DAMAGE_INTERVAL_MS,
	SNAPSHOT_INTERVAL_TICKS,
	VALVE_INTERACT_RANGE,
	VOICE_AUDIBLE_LEVEL,
	walkieCount,
} from "../../shared/config/index.js";
import type { SpeciesId } from "../../shared/config/species.js";
import type { DevModes } from "../../shared/devModes.js";
import {
	DEFAULT_HAT_PATTERN,
	type HatPattern,
} from "../../shared/hatPatterns.js";
import { BREW_DURATION_MS } from "../../shared/manor/brews.js";
import {
	assignRecipeMaterials,
	recipeDeck,
} from "../../shared/manor/furnish/pickups.js";
import {
	generateManor,
	layoutChecksum,
} from "../../shared/manor/generateManor.js";
import {
	type LiquidVolume,
	liquidAt,
	liquidVolumes,
} from "../../shared/manor/liquids.js";
import type { Level, ManorLayout } from "../../shared/manor/types.js";
import {
	type MatchConfig,
	matchDurationMs,
	pickupTotal,
	TUTORIAL_WOUNDED_HEALTH,
} from "../../shared/matchConfig.js";
import type { Vec3 } from "../../shared/math.js";
import { NavGrid } from "../../shared/navigation/navGrid.js";
import { PathFinder } from "../../shared/navigation/pathfinding.js";
import { supportHeight } from "../../shared/physics/character.js";
import { CollisionWorld } from "../../shared/physics/collisionWorld.js";
import { lineOfSight } from "../../shared/physics/lineOfSight.js";
import type {
	AbortReason,
	ServerToClientEvents,
} from "../../shared/protocol/events.js";
import type {
	CastRequest,
	ClientStateMessage,
	DamageCause,
	ForcedMoveKind,
	GameEvent,
	InteractRequest,
	MatchInit,
	MatchResults,
	ProjectileKind,
	WorldSnapshot,
} from "../../shared/protocol/game.js";
import { SeededRandom } from "../../shared/random.js";
import {
	DEFAULT_LANTERN_TINT,
	type LanternTint,
	type Tagline,
} from "../../shared/rewards.js";
import { teamStandings } from "../../shared/teams.js";
import { AnomalyEntity } from "./ai/AnomalyEntity.js";
import { witnessHide } from "./ai/hunter.js";
import { clearPath, faceTowards, hoverHeight } from "./ai/locomotion.js";
import { lureAnomalies } from "./ai/lure.js";
import { releaseClaim } from "./ai/patrol.js";
import type { SoundEvent } from "./ai/perception.js";
import { separateAnomalies } from "./ai/separation.js";
import { anomalyExtra, updateAnomaly } from "./ai/updateAnomaly.js";
import { AwardTracker, liveChallengeMetrics, pickAwards } from "./awards.js";
import { HighlightRecorder } from "./highlights.js";
import { MatchPlayer } from "./MatchPlayer.js";
import { formulaWords, planRoster, type RosterPlan } from "./roster.js";
import { CameraSystem } from "./systems/cameras.js";
import { validateCast } from "./systems/captures.js";
import { type DoorState, DoorSystem } from "./systems/doors.js";
import { drainEnergy, pauseEnergyRegen, stepEnergy } from "./systems/energy.js";
import { HazardSystem } from "./systems/hazards.js";
import { LightingMap } from "./systems/lighting.js";
import { LootSystem } from "./systems/loot.js";
import {
	applyClientState,
	archivistPullVector,
} from "./systems/playerMotion.js";
import { checkVoiceSabotage, tryPush, tryShout } from "./systems/sabotage.js";
import {
	archivistDangerZones,
	pickAnomalySpawn,
	pickPlayerSpawns,
	pickRespawn,
	type SpawnContext,
} from "./systems/spawning.js";
import { StakeSystem } from "./systems/stakes.js";
import { ValveSystem } from "./systems/valves.js";
import { WalkieSystem } from "./systems/walkies.js";

export interface MatchParticipant {
	id: string;
	name: string;
	color: number;
	pattern?: HatPattern;
	lantern?: LanternTint;
	tagline?: Tagline | null;
	team?: number | null;
}

export interface MatchTransport {
	broadcast<E extends keyof ServerToClientEvents>(
		event: E,
		...args: Parameters<ServerToClientEvents[E]>
	): void;
	broadcastVolatile<E extends keyof ServerToClientEvents>(
		event: E,
		...args: Parameters<ServerToClientEvents[E]>
	): void;
	toPlayer<E extends keyof ServerToClientEvents>(
		playerId: string,
		event: E,
		...args: Parameters<ServerToClientEvents[E]>
	): void;
}

export interface MatchOptions {
	id: string;
	seed: number;
	config: MatchConfig;
	participants: MatchParticipant[];
	transport: MatchTransport;
	previousWords: ReadonlySet<string>;
	clock: () => number;
	onFinished: (results: MatchResults | null) => void;
	autoStart?: boolean;
	dev?: boolean;
	tutorial?: boolean;
	daily?: string | null;
}

const TUTORIAL_MONSTER_LEASH = 3.8;
const TUTORIAL_CALM_STATES = new Set(["idle", "patrol", "travel", "search"]);

export type MatchPhase = "loading" | "playing" | "ended";

const CHALLENGE_SYNC_TICKS = Math.round(2000 / SERVER_TICK_MS);

export class Match {
	readonly id: string;
	readonly seed: number;
	readonly config: MatchConfig;
	readonly layout: ManorLayout;
	readonly checksum: number;
	readonly world: CollisionWorld;
	readonly grid: NavGrid;
	readonly finder: PathFinder;
	readonly lighting: LightingMap;
	readonly rng: SeededRandom;
	readonly doors: DoorSystem;
	readonly valves: ValveSystem;
	readonly hazards: HazardSystem;
	readonly liquids: LiquidVolume[];
	readonly loot = new LootSystem();
	readonly walkies: WalkieSystem;
	readonly stakes: StakeSystem;
	readonly walkieTotal: number;
	readonly cameras: CameraSystem;
	readonly cameraTotal: number;
	readonly awards = new AwardTracker();
	private readonly challengesSent = new Map<string, string>();
	readonly highlights: HighlightRecorder | null;
	readonly daily: string | null;
	readonly tutorial: boolean;
	readonly pickupTotal: number;
	private tutorialLured = false;
	private tutorialFollowAt = 0;
	readonly players = new Map<string, MatchPlayer>();
	readonly anomalies: AnomalyEntity[];
	readonly roster: RosterPlan;
	readonly roomClaims = new Map<number, number>();
	readonly roomVisits = new Map<number, number>();
	readonly sounds: SoundEvent[] = [];
	phase: MatchPhase = "loading";
	now: number;
	createdAt: number;
	startedAt = 0;
	endsAt = 0;
	anomaliesStartAt = 0;
	nextAnomalyAt = 0;
	tick = 0;
	private readonly transport: MatchTransport;
	private readonly clock: () => number;
	private readonly onFinished: (results: MatchResults | null) => void;
	private readonly pendingEvents: GameEvent[] = [];
	private readonly sprintLockTimes = new Map<string, number>();
	private readonly footstepTimes = new Map<string, number>();
	private forcedMoveCounter = 0;
	private timer: NodeJS.Timeout | null = null;
	private accumulator = 0;
	private lastClock = 0;

	readonly dev: boolean;

	constructor(options: MatchOptions) {
		this.id = options.id;
		this.seed = options.seed;
		this.config = options.config;
		this.transport = options.transport;
		this.clock = options.clock;
		this.onFinished = options.onFinished;
		this.dev = options.dev ?? false;
		this.tutorial = options.tutorial ?? false;
		this.daily = options.daily ?? null;
		this.now = this.clock();
		this.createdAt = this.now;
		this.pickupTotal = pickupTotal(this.config, options.participants.length);
		this.layout = generateManor(this.seed, {
			...this.config,
			pickupTotal: this.pickupTotal,
		});
		this.checksum = layoutChecksum(this.layout);
		this.world = new CollisionWorld(this.layout);
		this.grid = new NavGrid(this.world);
		this.finder = new PathFinder(this.grid);
		this.lighting = new LightingMap(this.grid);
		this.rng = new SeededRandom((this.seed ^ 0x5bd1e995) >>> 0);
		this.doors = new DoorSystem(this.layout, this.world);
		this.valves = new ValveSystem(this.layout.valves);
		this.hazards = new HazardSystem(this.world);
		this.liquids = liquidVolumes(this.layout.furniture);
		this.walkieTotal = Math.min(
			this.layout.walkies.length,
			walkieCount(options.participants.length),
		);
		this.walkies = new WalkieSystem(
			this.layout.walkies.slice(0, this.walkieTotal).map((spot) => spot.id),
		);
		this.cameraTotal = this.tutorial
			? 0
			: Math.min(
					this.layout.cameras.length,
					cameraCount(options.participants.length),
				);
		this.cameras = new CameraSystem(
			this.layout.cameras.slice(0, this.cameraTotal).map((spot) => spot.id),
		);
		this.stakes = new StakeSystem(this.layout.stakes);
		this.highlights = this.tutorial
			? null
			: new HighlightRecorder(
					(id) => this.anomalies[id]?.species ?? null,
					(windows) => this.emit({ type: "voiceWindows", windows }),
				);
		this.roster = planRoster(
			this.rng.fork("roster"),
			this.tutorial ? 1 : anomalyRosterSize(this.config.simultaneousAnomalies),
			options.previousWords,
			this.config.species,
		);
		const tutorialObject = this.roster.instances[0]?.occult;
		if (this.tutorial && tutorialObject) {
			assignRecipeMaterials(
				this.layout.pickups,
				OCCULT_RECIPES[tutorialObject],
			);
			this.loot.respawnPool = recipeDeck(OCCULT_RECIPES[tutorialObject]);
		}
		this.anomalies = this.roster.instances.map(
			(instance, index) =>
				new AnomalyEntity(
					index,
					instance.species,
					instance.exemplar,
					instance.exemplarCount,
					instance.formula,
					instance.occult,
				),
		);
		const spawns = pickPlayerSpawns(
			this.spawnContext(),
			options.participants.length,
		);
		options.participants.forEach((participant, index) => {
			const spawn = spawns[index % Math.max(1, spawns.length)] ?? {
				x: 0,
				y: 0,
				z: 0,
				yaw: 0,
			};
			const player = new MatchPlayer(
				participant.id,
				participant.name,
				participant.color,
				spawn,
				this.now,
			);
			player.pattern = participant.pattern ?? DEFAULT_HAT_PATTERN;
			player.lantern = participant.lantern ?? DEFAULT_LANTERN_TINT;
			player.tagline = participant.tagline ?? null;
			player.team =
				this.config.teamCount > 0 ? (participant.team ?? null) : null;
			player.roomId = this.roomIdAt(player.position);
			this.players.set(participant.id, player);
			this.awards.addPlayer(participant.id);
		});
		if (options.autoStart !== false) {
			this.startLoop();
		}
	}

	get usedFormulaWords(): Set<string> {
		return formulaWords(this.roster);
	}

	initPayload(): MatchInit {
		return {
			matchId: this.id,
			seed: this.seed,
			config: this.config,
			layoutChecksum: this.checksum,
			players: [...this.players.values()].map((player) => ({
				id: player.id,
				name: player.name,
				color: player.color,
				pattern: player.pattern,
				lantern: player.lantern,
				tagline: player.tagline,
				team: player.team,
				spawn: {
					x: player.position.x,
					y: player.position.y,
					z: player.position.z,
					yaw: player.yaw,
				},
			})),
			pool: this.roster.pool,
			roster: this.anomalies.map((entity) => ({
				id: entity.id,
				species: entity.species,
				exemplar: entity.exemplar,
				exemplarCount: entity.exemplarCount,
				formula: [...entity.formula],
				occult: entity.occult,
			})),
			durationMs: matchDurationMs(this.config),
			anomalySpawnDelayMs: this.tutorial ? 0 : ANOMALY_FIRST_SPAWN_DELAY_MS,
			serverTime: this.clock(),
			dev: this.dev,
			tutorial: this.tutorial,
			pickupTotal: this.pickupTotal,
			walkieTotal: this.walkieTotal,
			cameraTotal: this.cameraTotal,
		};
	}

	startLoop(): void {
		this.lastClock = this.clock();
		this.timer = setInterval(() => this.pump(), SERVER_TICK_MS / 2);
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	private pump(): void {
		const current = this.clock();
		this.accumulator = Math.min(
			this.accumulator + (current - this.lastClock),
			SERVER_TICK_MS * 6,
		);
		this.lastClock = current;
		let steps = 0;
		while (this.accumulator >= SERVER_TICK_MS && steps < 4) {
			this.accumulator -= SERVER_TICK_MS;
			this.step(current - this.accumulator);
			steps += 1;
		}
	}

	step(time = this.clock()): void {
		this.now = time;
		this.tick += 1;
		const dt = SERVER_TICK_MS / 1000;
		if (this.phase === "loading") {
			this.updateLoading();
			this.flushEvents();
			return;
		}
		if (this.phase !== "playing") {
			return;
		}
		this.sounds.length = 0;
		this.updatePlayers(dt);
		this.valves.heal(this.players.values(), this.now, dt);
		this.updateHazards();
		this.loot.update(this);
		this.walkies.update(this);
		this.cameras.update(this);
		this.stakes.update(this, dt);
		this.updateAnomalies(dt);
		checkVoiceSabotage(this);
		this.updateCasting();
		this.trackAwards();
		if (this.tick % CHALLENGE_SYNC_TICKS === 0) {
			this.syncChallenges();
		}
		if (this.tick % SNAPSHOT_INTERVAL_TICKS === 0) {
			const snapshot = this.snapshot();
			this.transport.broadcastVolatile("game:snapshot", snapshot);
			this.highlights?.frame(snapshot, this);
		}
		this.flushEvents();
		if (this.now >= this.endsAt) {
			this.finish();
		}
	}

	private updateLoading(): void {
		const connected = [...this.players.values()].filter(
			(player) => player.connected,
		);
		const everyoneLoaded =
			connected.length > 0 && connected.every((player) => player.loaded);
		if (
			everyoneLoaded ||
			this.now - this.createdAt > MATCH_LOADING_TIMEOUT_MS
		) {
			this.begin();
		}
		if (connected.length === 0 && this.now - this.createdAt > 5000) {
			this.abort("all-left");
		}
	}

	begin(): void {
		if (this.phase !== "loading") {
			return;
		}
		this.phase = "playing";
		this.startedAt = this.now;
		this.endsAt = this.now + matchDurationMs(this.config);
		this.anomaliesStartAt = this.tutorial
			? Infinity
			: this.now + ANOMALY_FIRST_SPAWN_DELAY_MS;
		for (const entity of this.anomalies) {
			entity.spawnDueAt = this.anomaliesStartAt + entity.id * 150;
		}
		for (const player of this.players.values()) {
			player.lastStateAt = this.now;
			player.protectedUntil = this.now + PLAYER_SPAWN_PROTECTION_MS;
		}
		this.transport.broadcast("game:begin", {
			matchId: this.id,
			serverTime: this.clock(),
			startedAt: this.startedAt,
			endsAt: this.endsAt,
		});
	}

	emit(event: GameEvent): void {
		this.pendingEvents.push(event);
		this.awards.event(event, this.players);
		this.highlights?.event(event, this);
	}

	openDoors(): number[] {
		return this.doors.doors.flatMap((door) => (door?.open ? [door.id] : []));
	}

	private trackAwards(): void {
		const chased = new Set(
			this.anomalies.flatMap((entity) =>
				entity.active &&
				entity.targetId &&
				(entity.state === "chase" || entity.state === "windup")
					? [entity.targetId]
					: [],
			),
		);
		for (const player of this.players.values()) {
			this.awards.tick(player, this.now, chased.has(player.id));
		}
	}

	private syncChallenges(): void {
		if (this.tutorial) {
			return;
		}
		for (const player of this.players.values()) {
			const stats = this.awards.stats.get(player.id);
			if (!stats) {
				continue;
			}
			const metrics = liveChallengeMetrics(stats);
			const key = JSON.stringify(metrics);
			if (this.challengesSent.get(player.id) !== key) {
				this.challengesSent.set(player.id, key);
				this.transport.toPlayer(player.id, "game:challenges", metrics);
			}
		}
	}

	private finalChallengeMetrics(
		results: MatchResults,
	): Record<string, MatchMetrics> {
		if (this.tutorial) {
			return {};
		}
		return Object.fromEntries(
			results.entries.map((entry) => {
				const stats = this.awards.stats.get(entry.playerId);
				const won = entryWon(results, entry);
				const flawless = entry.deaths === 0;
				return [
					entry.playerId,
					{
						...(stats ? liveChallengeMetrics(stats) : {}),
						games: 1,
						wins: won ? 1 : 0,
						flawless: flawless ? 1 : 0,
						flawlessWins: won && flawless ? 1 : 0,
						dailies: results.daily ? 1 : 0,
					} satisfies MatchMetrics,
				];
			}),
		);
	}

	private flushEvents(): void {
		if (this.pendingEvents.length === 0) {
			return;
		}
		const events = this.pendingEvents.splice(0, this.pendingEvents.length);
		this.transport.broadcast("game:events", { t: this.now, events });
	}

	snapshot(): WorldSnapshot {
		return {
			tick: this.tick,
			t: this.now,
			remainingMs: Math.max(0, this.endsAt - this.now),
			players: [...this.players.values()].map((player) =>
				player.snapshot(this.now),
			),
			anomalies: this.anomalies
				.filter((entity) => entity.active)
				.map((entity) =>
					entity.snapshot(this.now, anomalyExtra(entity, this.now)),
				),
		};
	}

	spawnContext(): SpawnContext {
		return {
			layout: this.layout,
			grid: this.grid,
			rng: this.rng,
			players: [...this.players.values()],
			anomalies: this.anomalies,
			dangerZones: archivistDangerZones(this.anomalies, this.layout),
		};
	}

	roomIdAt(position: Vec3): number | null {
		return (
			this.world.roomAt({ x: position.x, z: position.z }, position.y)?.id ??
			null
		);
	}

	gridLevelOf(position: Vec3): Level {
		const node = this.grid.nearestNode(position, 1, false);
		if (node === null || this.grid.isPortal(node)) {
			return this.grid.levelForHeight(position.y, 1.8);
		}
		return this.grid.levelOfNode(node);
	}

	groundHeightAt(
		position: { x: number; z: number },
		nearY: number,
	): number | null {
		return supportHeight(this.world, position.x, position.z, nearY + 0.45, 0.45)
			.height;
	}

	illuminationOf(player: MatchPlayer): number {
		let light = this.lighting.staticAt(player.position);
		if (player.lanternOpen) {
			light += 1;
		}
		for (const other of this.players.values()) {
			if (other === player || !other.lanternOpen || !other.active) {
				continue;
			}
			const distance = Math.hypot(
				other.position.x - player.position.x,
				other.position.z - player.position.z,
			);
			if (distance < 6 && Math.abs(other.position.y - player.position.y) < 2) {
				light += 0.6 * (1 - distance / 6);
			}
		}
		return light;
	}

	pullOn(player: MatchPlayer): { x: number; z: number } {
		return archivistPullVector(this, player);
	}

	sprintLockedAt(player: MatchPlayer): number {
		return this.sprintLockTimes.get(player.id) ?? -Infinity;
	}

	private updatePlayers(dt: number): void {
		for (const player of this.players.values()) {
			if (
				!player.connected &&
				player.disconnectedAt !== null &&
				this.now - player.disconnectedAt > RECONNECT_GRACE_MS
			) {
				player.alive = false;
				player.respawnAt = Infinity;
				continue;
			}
			if (!player.alive) {
				if (this.now >= player.respawnAt && player.connected) {
					this.respawn(player);
				}
				continue;
			}
			const energy = stepEnergy(player, dt);
			if (energy.sprintLockedNow) {
				this.sprintLockTimes.set(player.id, this.now);
			}
			this.updateSlime(player);
			this.updateBrew(player);
			this.trackRoom(player);
			this.emitPlayerSounds(player);
		}
	}

	/** Tremper dans un chaudron donne son effet ; y rester ne le relance pas. */
	private updateBrew(player: MatchPlayer): void {
		if (player.brew !== null && this.now >= player.brewUntil) {
			player.brew = null;
		}
		const liquid =
			player.hidden || player.carried
				? null
				: liquidAt(this.liquids, player.position);
		const cauldron = liquid?.brew ? liquid : null;
		const entered =
			cauldron !== null && cauldron.itemId !== player.brewCauldron;
		player.brewCauldron = cauldron?.itemId ?? null;
		if (!entered || !cauldron.brew) {
			return;
		}
		const effect = cauldron.brew.effect;
		player.brew = effect;
		player.brewUntil = this.now + BREW_DURATION_MS[effect];
		if (effect === "vigor") {
			player.energy = ENERGY_MAX;
			player.sprintLocked = false;
		}
		this.emit({
			type: "brew",
			playerId: player.id,
			effect,
			until: player.brewUntil,
		});
	}

	private clearBrew(player: MatchPlayer): void {
		player.brewCauldron = null;
		if (player.brew === null) {
			return;
		}
		player.brew = null;
		player.brewUntil = 0;
		this.emit({ type: "brew", playerId: player.id, effect: null, until: 0 });
	}

	private updateSlime(player: MatchPlayer): void {
		const slimed = this.hazards.isOnSlime(player);
		if (slimed && !player.slimed) {
			player.slimeDamageAt = this.now;
		}
		player.slimed = slimed;
		if (
			slimed &&
			this.now - player.slimeDamageAt >= SLIME_PUDDLE_DAMAGE_INTERVAL_MS
		) {
			player.slimeDamageAt = this.now;
			this.applyDamage(player, SLIME_PUDDLE_DAMAGE, "suinteur", null, true);
		}
	}

	private trackRoom(player: MatchPlayer): void {
		if (player.hidden || player.carried) {
			return;
		}
		const room = this.roomIdAt(player.position);
		if (room === player.roomId) {
			return;
		}
		player.roomId = room;
		if (room === null) {
			return;
		}
		const archivist = this.anomalies.find(
			(entity) =>
				entity.active &&
				entity.species === "archiviste" &&
				entity.homeRoom === room,
		);
		if (archivist) {
			this.closeRoomDoors(room, archivist);
		}
	}

	private closeRoomDoors(roomId: number, archivist: AnomalyEntity): void {
		const room = this.layout.rooms[roomId];
		for (const openingId of room.openingIds) {
			const opening = this.layout.openings[openingId];
			if (!opening.door) {
				continue;
			}
			const doorId = opening.door.id;
			const door = this.doors.get(doorId);
			const cooldown = archivist.doorCooldowns.get(doorId) ?? 0;
			if (!door?.open || this.now < cooldown) {
				continue;
			}
			const blocked = [...this.players.values()].some(
				(player) =>
					player.alive &&
					Math.hypot(
						player.position.x - door.center.x,
						player.position.z - door.center.z,
					) < 1.05,
			);
			if (blocked) {
				continue;
			}
			archivist.doorCooldowns.set(doorId, this.now + 6000);
			this.setDoor(doorId, false, null);
		}
	}

	private emitPlayerSounds(player: MatchPlayer): void {
		const voice = this.audibleVoice(player);
		if (player.hidden || player.carried) {
			if (voice !== null) {
				this.sounds.push({
					position: { ...player.position },
					loudness: 2 + voice * 8,
					playerId: player.id,
					kind: "voice",
				});
			}
			return;
		}
		const sprinting =
			player.sprintIntent &&
			player.moveInput &&
			!player.sprintLocked &&
			player.crouch < 0.5;
		const last = this.footstepTimes.get(player.id) ?? 0;
		if (
			player.moveInput &&
			player.grounded &&
			this.now - last > (sprinting ? 350 : 600)
		) {
			this.footstepTimes.set(player.id, this.now);
			const loudness = sprinting ? 9 : player.crouching ? 1.2 : 3.2;
			this.sounds.push({
				position: { ...player.position },
				loudness,
				playerId: player.id,
				kind: "footsteps",
			});
		}
		if (voice !== null) {
			this.sounds.push({
				position: { ...player.position },
				loudness: 4 + voice * 14,
				playerId: player.id,
				kind: "voice",
			});
		}
	}

	private audibleVoice(player: MatchPlayer): number | null {
		const level = player.voiceLevelNow(this.now);
		if (level < VOICE_AUDIBLE_LEVEL) {
			return null;
		}
		return (level - VOICE_AUDIBLE_LEVEL) / (1 - VOICE_AUDIBLE_LEVEL);
	}

	private updateHazards(): void {
		for (const outcome of this.hazards.stepProjectiles(
			this.players.values(),
			this.now,
		)) {
			const projectile = outcome.projectile;
			this.emit({
				type: "projectileEnd",
				id: projectile.id,
				at: outcome.at,
				hitPlayer: outcome.player?.id ?? null,
			});
			const owner = this.anomalies[projectile.ownerId];
			if (outcome.player && owner && owner.definition.damage > 0) {
				this.applyDamage(
					outcome.player,
					owner.definition.damage,
					owner.species,
					outcome.at,
				);
			}
			if (projectile.kind === "slime" && outcome.ground) {
				const puddle = this.hazards.addPuddle(outcome.ground, this.now);
				this.emit({
					type: "puddle",
					id: puddle.id,
					x: puddle.x,
					y: puddle.y,
					z: puddle.z,
					radius: puddle.radius,
					expiresAt: puddle.expiresAt,
				});
			}
		}
		for (const puddle of this.hazards.expirePuddles(this.now)) {
			this.emit({ type: "puddleRemoved", id: puddle.id });
		}
	}

	launchProjectile(
		kind: ProjectileKind,
		origin: Vec3,
		velocity: Vec3,
		gravity: number,
		owner: AnomalyEntity,
	): void {
		const projectile = this.hazards.launch(
			kind,
			origin,
			velocity,
			gravity,
			this.now,
			owner.id,
		);
		this.emit({
			type: "projectile",
			id: projectile.id,
			kind,
			origin,
			velocity,
			gravity,
			launchedAt: this.now,
		});
	}

	private updateAnomalies(dt: number): void {
		this.spawnWaitingAnomalies();
		for (const entity of this.anomalies) {
			if (!entity.active) {
				continue;
			}
			updateAnomaly(this, entity, dt);
		}
		this.keepTutorialMonsterClose();
		separateAnomalies(this);
		for (const entity of this.anomalies) {
			if (entity.active) {
				entity.history.push({
					t: this.now,
					...entity.position,
					yaw: entity.yaw,
				});
			}
		}
	}

	private spawnWaitingAnomalies(): void {
		if (this.now < this.anomaliesStartAt || this.now < this.nextAnomalyAt) {
			return;
		}
		const running = this.anomalies.filter((entity) => entity.active);
		let active = running.length;
		const perTier = { 1: 0, 2: 0, 3: 0 };
		for (const entity of running) {
			perTier[entity.definition.tier] += 1;
		}
		const waiting = this.anomalies
			.filter((entity) => !entity.active && this.now >= entity.spawnDueAt)
			.sort(
				(first, second) =>
					first.spawnDueAt - second.spawnDueAt || first.id - second.id,
			);
		let attempts = 0;
		for (const entity of waiting) {
			if (active >= this.config.simultaneousAnomalies || attempts >= 2) {
				return;
			}
			const tier = entity.definition.tier;
			if (perTier[tier] >= this.tierCaps[tier]) {
				continue;
			}
			attempts += 1;
			if (this.placeAnomaly(entity)) {
				active += 1;
				perTier[tier] += 1;
			} else {
				entity.spawnDueAt = this.now + ANOMALY_SPAWN_RETRY_MS;
			}
		}
	}

	/**
	 * Le réglage du lobby prime : si les espèces choisies ne permettent pas
	 * d'atteindre le nombre demandé en respectant les paliers, ces derniers sautent.
	 */
	private get tierCaps(): Record<1 | 2 | 3, number> {
		const wanted = this.config.simultaneousAnomalies;
		const caps = anomalyTierCaps(wanted);
		const available = { 1: 0, 2: 0, 3: 0 };
		for (const entity of this.anomalies) {
			available[entity.definition.tier] += 1;
		}
		const reachable =
			Math.min(caps[1], available[1]) +
			Math.min(caps[2], available[2]) +
			Math.min(caps[3], available[3]);
		return reachable >= wanted ? caps : { 1: wanted, 2: wanted, 3: wanted };
	}

	placeAnomaly(entity: AnomalyEntity): boolean {
		const spot = pickAnomalySpawn(this.spawnContext(), entity);
		if (!spot) {
			return false;
		}
		entity.resetForSpawn(
			{ ...spot.position, y: spot.position.y + hoverHeight(entity) },
			spot.yaw,
			this.now,
		);
		entity.homeRoom = entity.species === "archiviste" ? spot.roomId : null;
		entity.homePoint =
			entity.species === "luciole" ? { ...spot.position } : null;
		entity.nextPulseAt = this.now + 2000;
		entity.nextScreamAt = this.now + 3000;
		this.emit({
			type: "anomalySpawn",
			anomalyId: entity.id,
			gen: entity.gen,
			species: entity.species,
		});
		return true;
	}

	private updateCasting(): void {
		for (const player of this.players.values()) {
			if (player.casting && this.now - player.casting.since > 12_000) {
				player.casting = null;
			}
		}
	}

	applyDamage(
		player: MatchPlayer,
		amount: number,
		source: SpeciesId | DamageCause,
		from: Vec3 | null,
		periodic = false,
	): boolean {
		if (
			this.tutorial ||
			!player.alive ||
			player.hidden ||
			player.protectedUntil > this.now ||
			player.devModes.immortal
		) {
			return false;
		}
		const lethal = source === "explosion";
		if (
			!lethal &&
			!periodic &&
			this.now - player.lastDamageAt < PLAYER_DAMAGE_INTERVAL_MS
		) {
			return false;
		}
		if (!periodic) {
			player.lastDamageAt = this.now;
		}
		player.health = lethal ? 0 : Math.max(0, player.health - amount);
		this.emit({
			type: "damage",
			playerId: player.id,
			amount: lethal ? HEALTH_MAX : amount,
			source,
			hp: player.health,
			from,
			periodic,
		});
		if (player.health <= 0) {
			this.kill(player, source);
		}
		return true;
	}

	applyFallDamage(player: MatchPlayer, amount: number, drop = 0): void {
		if (!this.tutorial) {
			if (this.applyDamage(player, amount, "fall", null)) {
				this.highlights?.fall(player.id, drop, !player.alive, this);
			}
			return;
		}
		const health = Math.max(1, player.health - amount);
		if (health < player.health && !player.devModes.immortal) {
			const lost = player.health - health;
			player.health = health;
			this.emit({
				type: "damage",
				playerId: player.id,
				amount: lost,
				source: "fall",
				hp: health,
				from: null,
				periodic: false,
			});
		}
	}

	private kill(player: MatchPlayer, cause: SpeciesId | DamageCause): void {
		this.walkies.release(this, player);
		this.cameras.release(this, player);
		const fragmentsLost = this.tutorial
			? 0
			: this.loot.loseFragments(this, player);
		player.alive = false;
		player.deaths += 1;
		player.respawnAt = this.now + PLAYER_RESPAWN_DELAY_MS;
		player.lanternOpen = false;
		player.casting = null;
		player.velocity = { x: 0, y: 0, z: 0 };
		this.emit({
			type: "death",
			playerId: player.id,
			respawnAt: player.respawnAt,
			cause,
			fragmentsLost,
		});
	}

	private respawn(player: MatchPlayer): void {
		const spawn = pickRespawn(this.spawnContext(), player);
		if (!spawn) {
			player.respawnAt = this.now + 1000;
			return;
		}
		player.alive = true;
		player.health = HEALTH_MAX;
		player.energy = ENERGY_MAX;
		player.energyRegenPause = 0;
		player.sprintLocked = false;
		player.hiddenSpot = -1;
		player.carriedBy = -1;
		player.protectedUntil = this.now + PLAYER_RESPAWN_PROTECTION_MS;
		player.petrifiedUntil = 0;
		player.castBlockedUntil = 0;
		this.clearBrew(player);
		this.forcedMove(player, "respawn", spawn, spawn.yaw, 0);
		player.roomId = this.roomIdAt(player.position);
		this.emit({
			type: "respawn",
			playerId: player.id,
			protectedUntil: player.protectedUntil,
		});
	}

	forcedMove(
		player: MatchPlayer,
		kind: ForcedMoveKind,
		position: Vec3,
		yaw: number | null,
		durationMs: number,
	): void {
		this.forcedMoveCounter += 1;
		player.lastForcedMoveId = this.forcedMoveCounter;
		player.position = { ...position };
		player.velocity = { x: 0, y: 0, z: 0 };
		player.fallPeakY = null;
		player.movementBudget = 1.5;
		if (yaw !== null) {
			player.yaw = yaw;
		}
		player.history.push({ t: this.now, ...position, yaw: player.yaw });
		this.transport.toPlayer(player.id, "game:forcedMove", {
			playerId: player.id,
			moveId: player.lastForcedMoveId,
			kind,
			x: position.x,
			y: position.y,
			z: position.z,
			yaw,
			durationMs,
			hideSpot: player.hiddenSpot,
		});
	}

	correctPlayer(player: MatchPlayer): void {
		this.forcedMove(player, "correction", player.position, null, 140);
	}

	setDoor(doorId: number, open: boolean, by: string | null): boolean {
		if (!this.doors.setOpen(doorId, open, this.now)) {
			return false;
		}
		const door = this.doors.get(doorId) as DoorState;
		this.emit({ type: "door", doorId, open, by });
		this.sounds.push({
			position: { ...door.center, y: door.center.y - 1.1 },
			loudness: 7,
			playerId: by,
			kind: "door",
		});
		return true;
	}

	openDoorByAnomaly(entity: AnomalyEntity, doorId: number): void {
		this.setDoor(doorId, true, `anomaly:${entity.id}`);
	}

	handleClientState(playerId: string, message: ClientStateMessage): void {
		const player = this.players.get(playerId);
		if (!player || this.phase === "ended") {
			return;
		}
		this.now = this.clock();
		applyClientState(this, player, message);
	}

	handleLantern(playerId: string, open: boolean): void {
		const player = this.players.get(playerId);
		if (
			!player?.alive ||
			player.hidden ||
			player.carried ||
			this.phase !== "playing"
		) {
			return;
		}
		if (open && player.energy < LANTERN_MIN_ENERGY_TO_OPEN) {
			return;
		}
		if (open && !player.lanternOpen) {
			drainEnergy(player, LANTERN_OPEN_ENERGY_COST);
			pauseEnergyRegen(player, ENERGY_USE_REGEN_PAUSE_SECONDS);
		}
		player.lanternOpen = open;
	}

	handleInteract(playerId: string, request: InteractRequest): void {
		const player = this.players.get(playerId);
		if (
			!player ||
			this.phase !== "playing" ||
			!player.alive ||
			player.carried
		) {
			return;
		}
		this.now = this.clock();
		switch (request.kind) {
			case "door":
				this.interactDoor(player, request.id);
				break;
			case "hide":
				this.hidePlayer(player, request.id);
				break;
			case "unhide":
				this.unhidePlayer(player, "unhide");
				break;
			case "valve":
				this.interactValve(player, request.id);
				break;
			case "pickup":
				this.loot.take(this, player, request.id);
				break;
			case "walkie":
				this.walkies.take(this, player, request.id);
				break;
			case "camera":
				this.cameras.take(this, player, request.id);
				break;
			case "stake":
				this.stakes.interact(this, player, request.id);
				break;
		}
	}

	handleCraft(playerId: string, altarId: number, object: OccultId): void {
		const player = this.players.get(playerId);
		if (player?.alive && !player.carried && this.phase === "playing") {
			this.now = this.clock();
			this.loot.craft(this, player, altarId, object);
		}
	}

	sendInventory(player: MatchPlayer): void {
		this.transport.toPlayer(player.id, "game:inventory", {
			materials: { ...player.materials },
			objects: { ...player.objects },
		});
	}

	handleTutorialSummon(playerId: string): void {
		const player = this.players.get(playerId);
		const entity = this.anomalies[0];
		if (!this.tutorial || !player || !entity) {
			return;
		}
		if (entity.active) {
			this.tutorialLured = true;
			return;
		}
		this.now = this.clock();
		if (entity.occult && player.objects[entity.occult] < 1) {
			player.objects[entity.occult] = 1;
			this.sendInventory(player);
		}
		entity.resetForSpawn(this.tutorialSpawnPoint(player), player.yaw, this.now);
		entity.spawnDueAt = Infinity;
		this.emit({
			type: "anomalySpawn",
			anomalyId: entity.id,
			gen: entity.gen,
			species: entity.species,
		});
	}

	handleTutorialWound(playerId: string): void {
		const player = this.players.get(playerId);
		if (
			!this.tutorial ||
			!player?.alive ||
			player.health <= TUTORIAL_WOUNDED_HEALTH
		) {
			return;
		}
		const amount = player.health - TUTORIAL_WOUNDED_HEALTH;
		player.health = TUTORIAL_WOUNDED_HEALTH;
		this.emit({
			type: "damage",
			playerId: player.id,
			amount,
			source: this.anomalies[0]?.species ?? "murmure",
			hp: player.health,
			from: null,
			periodic: false,
		});
	}

	private keepTutorialMonsterClose(): void {
		const entity = this.anomalies[0];
		const player = [...this.players.values()][0];
		if (
			!this.tutorialLured ||
			!entity?.active ||
			!player?.active ||
			!TUTORIAL_CALM_STATES.has(entity.state)
		) {
			return;
		}
		const distance = Math.hypot(
			entity.position.x - player.position.x,
			entity.position.y - player.position.y,
			entity.position.z - player.position.z,
		);
		if (distance > TUTORIAL_MONSTER_LEASH) {
			if (this.now >= this.tutorialFollowAt) {
				this.tutorialFollowAt = this.now + 1500;
				lureAnomalies(this, player.position, player.id);
			}
			return;
		}
		if (entity.state !== "search") {
			clearPath(entity);
			entity.velocity = { x: 0, y: 0, z: 0 };
			faceTowards(entity, player.position, 4, SERVER_TICK_MS / 1000);
			if (entity.state !== "idle") {
				entity.setState("idle", this.now);
			}
			entity.idleUntil = this.now + 1000;
		}
	}

	private tutorialSpawnPoint(player: MatchPlayer): Vec3 {
		const level = this.gridLevelOf(player.position);
		let best: Vec3 = player.position;
		let bestScore = -Infinity;
		const eye = player.eyePosition();
		for (let node = 0; node < this.grid.cellsPerLevel; node += 1) {
			const cell = level * this.grid.cellsPerLevel + node;
			if (!this.grid.walkable[cell] || !this.grid.isInMainComponent(cell)) {
				continue;
			}
			const point = this.grid.nodePosition(cell);
			const distance = Math.hypot(
				point.x - player.position.x,
				point.z - player.position.z,
			);
			if (distance < 5 || distance > 12) {
				continue;
			}
			const hidden = !lineOfSight(this.world, eye, {
				...point,
				y: point.y + 1,
			});
			const score = (hidden ? 10 : 0) - Math.abs(distance - 8);
			if (score > bestScore) {
				bestScore = score;
				best = point;
			}
		}
		return best;
	}

	private interactDoor(player: MatchPlayer, doorId: number): void {
		const door = this.doors.get(doorId);
		if (!door || player.hidden) {
			return;
		}
		const eye = player.eyePosition();
		const distance = Math.hypot(
			door.center.x - eye.x,
			door.center.y - eye.y,
			door.center.z - eye.z,
		);
		if (
			distance > DOOR_INTERACT_RANGE + 0.6 ||
			!lineOfSight(this.world, eye, door.center, {
				ignoreDoors: true,
				blockGlass: true,
			})
		) {
			return;
		}
		this.setDoor(doorId, !door.open, player.id);
	}

	private interactValve(player: MatchPlayer, valveId: number): void {
		const valve = this.valves.valves[valveId];
		if (!valve || player.hidden) {
			return;
		}
		const eye = player.eyePosition();
		const point = valve.station.valve;
		if (
			Math.hypot(point.x - eye.x, point.y - eye.y, point.z - eye.z) >
			VALVE_INTERACT_RANGE + 0.5
		) {
			return;
		}
		const activated = this.valves.activate(valveId, this.now);
		if (activated) {
			this.emit({
				type: "valve",
				valveId,
				activeUntil: activated.activeUntil,
				cooldownUntil: activated.cooldownUntil,
			});
			this.sounds.push({
				position: { ...point },
				loudness: 6,
				playerId: player.id,
				kind: "water",
			});
		}
	}

	private hidePlayer(player: MatchPlayer, spotId: number): void {
		const spot = this.layout.hideSpots[spotId];
		if (!spot || player.hidden) {
			return;
		}
		const occupied = [...this.players.values()].some(
			(other) => other.hiddenSpot === spotId,
		);
		const distance = Math.hypot(
			spot.entry.x - player.position.x,
			spot.entry.z - player.position.z,
		);
		const furniture = this.layout.furniture[spot.furnitureId];
		if (
			occupied ||
			distance > HIDE_INTERACT_RANGE + 0.45 ||
			Math.abs(player.position.y - furniture.y) > 0.6
		) {
			return;
		}
		player.hiddenSpot = spotId;
		player.lanternOpen = false;
		player.casting = null;
		player.crouch = 0;
		this.forcedMove(
			player,
			"hide",
			{ x: spot.interior.x, y: furniture.y, z: spot.interior.z },
			spot.facing,
			380,
		);
		for (const entity of this.anomalies) {
			if (entity.active && entity.hostile) {
				witnessHide(this, entity, player, spotId);
			}
		}
	}

	unhidePlayer(player: MatchPlayer, kind: "unhide" | "extract"): void {
		if (!player.hidden) {
			return;
		}
		const spot = this.layout.hideSpots[player.hiddenSpot];
		const furniture = this.layout.furniture[spot.furnitureId];
		const exit = this.safeExit({
			x: spot.entry.x,
			y: furniture.y,
			z: spot.entry.z,
		});
		player.hiddenSpot = -1;
		this.forcedMove(
			player,
			kind,
			exit,
			spot.facing,
			kind === "extract" ? 260 : 360,
		);
		player.roomId = this.roomIdAt(exit);
	}

	extractPlayer(player: MatchPlayer): void {
		this.unhidePlayer(player, "extract");
	}

	private safeExit(preferred: Vec3): Vec3 {
		if (
			this.grid.isWalkablePoint(preferred) ||
			this.world.regionAt({ x: preferred.x, z: preferred.z }, preferred.y) !==
				null
		) {
			const node = this.grid.nearestNode(preferred, 0);
			if (node !== null) {
				return preferred;
			}
		}
		const node = this.grid.nearestNode(preferred, 4);
		return node === null ? preferred : this.grid.nodePosition(node);
	}

	handleCastBegin(playerId: string): void {
		const player = this.players.get(playerId);
		if (!player?.active || this.phase !== "playing") {
			return;
		}
		this.now = this.clock();
		if (player.castBlockedUntil > this.now) {
			return;
		}
		player.casting ??= { since: this.now };
	}

	handleCastCancel(playerId: string): void {
		const player = this.players.get(playerId);
		if (player) {
			player.casting = null;
		}
	}

	handleCast(playerId: string, request: CastRequest): void {
		const player = this.players.get(playerId);
		if (!player || this.phase !== "playing") {
			return;
		}
		this.now = this.clock();
		const result = validateCast(this, player, request);
		player.casting = null;
		if (result.ok) {
			const entity = this.anomalies[result.anomalyId];
			if (entity.occult && OCCULT_CONSUMED_ON_CAPTURE) {
				player.objects[entity.occult] -= 1;
				this.sendInventory(player);
			}
			player.score += entity.definition.points;
			player.captures += 1;
			this.emit({
				type: "capture",
				playerId: player.id,
				anomalyId: entity.id,
				gen: entity.gen,
				species: entity.species,
				points: entity.definition.points,
				score: player.score,
			});
			this.removeAnomaly(entity, "captured");
		}
		this.transport.toPlayer(player.id, "game:castResult", result);
	}

	handlePush(playerId: string, yaw: number): void {
		const player = this.players.get(playerId);
		if (player && this.phase === "playing") {
			this.now = this.clock();
			tryPush(this, player, yaw);
		}
	}

	handleRadio(playerId: string, on: boolean): void {
		const player = this.players.get(playerId);
		if (player && this.phase === "playing") {
			this.walkies.setTransmitting(player, on);
		}
	}

	/** Le vacarme du reliquaire : les portes claquent, il faut les rouvrir pour fuir. */
	slamRoomDoors(roomId: number): void {
		for (const openingId of this.layout.rooms[roomId]?.openingIds ?? []) {
			const opening = this.layout.openings[openingId];
			if (!opening.door || !this.doors.get(opening.door.id)?.open) {
				continue;
			}
			const door = this.doors.get(opening.door.id) as DoorState;
			const blocked = [...this.players.values()].some(
				(player) =>
					player.alive &&
					Math.hypot(
						player.position.x - door.center.x,
						player.position.z - door.center.z,
					) < 1.05,
			);
			if (!blocked) {
				this.setDoor(door.id, false, null);
			}
		}
	}

	handleDevModes(playerId: string, modes: DevModes): void {
		const player = this.players.get(playerId);
		if (player && this.dev) {
			player.devModes = modes;
			if (modes.infiniteEnergy) {
				player.energy = ENERGY_MAX;
				player.sprintLocked = false;
			}
		}
	}

	handleShout(playerId: string): void {
		const player = this.players.get(playerId);
		if (player && this.phase === "playing") {
			this.now = this.clock();
			this.tutorialLured ||= this.tutorial;
			tryShout(this, player);
		}
	}

	removeAnomaly(entity: AnomalyEntity, reason: "captured" | "exploded"): void {
		if (!entity.active) {
			return;
		}
		if (entity.carryingPlayerId) {
			const carried = this.players.get(entity.carryingPlayerId);
			entity.carryingPlayerId = null;
			if (carried && carried.carriedBy === entity.id) {
				this.dropCarried(carried, entity);
			}
		}
		releaseClaim(this, entity);
		entity.active = false;
		entity.state = "gone";
		entity.witnessed = null;
		entity.spawnDueAt = this.now + ANOMALY_RETURN_DELAY_MS;
		this.nextAnomalyAt = this.now + ANOMALY_NEXT_DELAY_MS;
		for (const other of this.anomalies) {
			if (other.hostId === entity.id) {
				other.hostId = -1;
			}
		}
		this.emit({
			type: "anomalyRemoved",
			anomalyId: entity.id,
			gen: entity.gen,
			reason,
			returnsAt: entity.spawnDueAt,
		});
	}

	explode(entity: AnomalyEntity, exposed: MatchPlayer[]): void {
		const killed: string[] = [];
		for (const player of exposed) {
			if (this.applyDamage(player, HEALTH_MAX, "explosion", entity.center())) {
				killed.push(player.id);
			}
		}
		this.emit({
			type: "explosion",
			anomalyId: entity.id,
			...entity.center(),
			radius: 5,
			killed,
		});
		this.removeAnomaly(entity, "exploded");
	}

	beginCarry(player: MatchPlayer, entity: AnomalyEntity): void {
		player.carriedBy = entity.id;
		player.casting = null;
		player.lanternOpen = false;
		this.emit({
			type: "carry",
			anomalyId: entity.id,
			playerId: player.id,
			active: true,
		});
	}

	attachCarried(player: MatchPlayer, entity: AnomalyEntity): void {
		player.position = {
			x: entity.position.x,
			y: entity.position.y + 0.2,
			z: entity.position.z,
		};
		player.history.push({ t: this.now, ...player.position, yaw: entity.yaw });
	}

	dropCarried(player: MatchPlayer, entity: AnomalyEntity): void {
		const node = this.grid.nearestNode(entity.position, 4);
		const position =
			node === null ? { ...entity.position } : this.grid.nodePosition(node);
		player.carriedBy = -1;
		this.forcedMove(player, "drop", position, entity.yaw + Math.PI, 300);
		player.roomId = this.roomIdAt(position);
		player.protectedUntil = Math.max(player.protectedUntil, this.now + 1200);
		this.emit({
			type: "carry",
			anomalyId: entity.id,
			playerId: player.id,
			active: false,
		});
	}

	playerLoaded(playerId: string): void {
		const player = this.players.get(playerId);
		if (player) {
			player.loaded = true;
		}
	}

	playerDisconnected(playerId: string): void {
		const player = this.players.get(playerId);
		if (!player) {
			return;
		}
		player.connected = false;
		player.disconnectedAt = this.now;
		player.casting = null;
		this.walkies.release(this, player);
		this.cameras.release(this, player);
		if (player.hidden) {
			this.unhidePlayer(player, "unhide");
		}
		const anyone = [...this.players.values()].some((other) => other.connected);
		if (!anyone && this.phase === "playing") {
			this.abort("all-disconnected");
		}
	}

	playerReconnected(playerId: string): void {
		const player = this.players.get(playerId);
		if (!player) {
			return;
		}
		player.connected = true;
		player.disconnectedAt = null;
		player.lastSeq = -1;
		this.transport.toPlayer(playerId, "game:init", this.initPayload());
		if (this.phase === "playing") {
			this.transport.toPlayer(playerId, "game:begin", {
				matchId: this.id,
				serverTime: this.clock(),
				startedAt: this.startedAt,
				endsAt: this.endsAt,
			});
		}
		this.transport.toPlayer(playerId, "game:events", {
			t: this.now,
			events: this.currentStateEvents(),
		});
		this.sendInventory(player);
		this.challengesSent.delete(playerId);
		if (player.alive) {
			this.forcedMove(player, "spawn", player.position, player.yaw, 0);
		}
	}

	currentStateEvents(): GameEvent[] {
		const events: GameEvent[] = [];
		for (const [id, material] of this.loot.respawned) {
			events.push({ type: "pickupBack", id, material });
		}
		for (const id of this.loot.returnsAt.keys()) {
			events.push({
				type: "pickup",
				id,
				playerId: "",
				material: this.loot.materialOf(this, id),
			});
		}
		for (const door of this.doors.doors) {
			if (door) {
				events.push({
					type: "door",
					doorId: door.id,
					open: door.open,
					by: null,
				});
			}
		}
		this.valves.valves.forEach((valve, valveId) => {
			if (valve.cooldownUntil > this.now) {
				events.push({
					type: "valve",
					valveId,
					activeUntil: valve.activeUntil,
					cooldownUntil: valve.cooldownUntil,
				});
			}
		});
		events.push(
			...this.walkies.stateEvents(),
			...this.cameras.stateEvents(),
			...this.stakes.stateEvents(),
		);
		for (const puddle of this.hazards.puddles) {
			events.push({
				type: "puddle",
				id: puddle.id,
				x: puddle.x,
				y: puddle.y,
				z: puddle.z,
				radius: puddle.radius,
				expiresAt: puddle.expiresAt,
			});
		}
		return events;
	}

	private finish(): void {
		if (this.phase === "ended") {
			return;
		}
		this.phase = "ended";
		this.stop();
		const entries = [...this.players.values()]
			.map((player) => ({
				playerId: player.id,
				name: player.name,
				score: player.score,
				captures: player.captures,
				deaths: player.deaths,
				color: player.color,
				pattern: player.pattern,
				tagline: player.tagline,
				team: player.team,
			}))
			.sort((a, b) => b.score - a.score || a.deaths - b.deaths);
		const teams = this.config.teamCount > 0 ? teamStandings(entries) : [];
		const top = entries[0];
		const tie = entries.length > 1 && entries[1].score === top?.score;
		const topTeam = teams[0];
		const teamTie = teams.length > 1 && teams[1].score === topTeam?.score;
		const results: MatchResults = {
			matchId: this.id,
			entries,
			teams,
			winnerId:
				teams.length === 0 && top && top.score > 0 && !tie
					? top.playerId
					: null,
			winnerTeam:
				topTeam && topTeam.score > 0 && !teamTie ? topTeam.team : null,
			durationMs: matchDurationMs(this.config),
			awards: pickAwards(this.awards.stats),
			highlights: this.highlights?.finish() ?? [],
			daily: this.daily,
			metrics: {},
		};
		results.metrics = this.finalChallengeMetrics(results);
		this.transport.broadcast("game:end", results);
		this.onFinished(results);
	}

	abort(reason: AbortReason): void {
		if (this.phase === "ended") {
			return;
		}
		this.phase = "ended";
		this.stop();
		this.transport.broadcast("game:aborted", { reason });
		this.onFinished(null);
	}
}
