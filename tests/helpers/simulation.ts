import { Match, type MatchTransport } from "../../server/game/Match.js";
import { SERVER_TICK_MS } from "../../shared/config/index.js";
import {
	type MatchConfig,
	PUBLIC_MATCH_CONFIG,
} from "../../shared/matchConfig.js";
import type { Vec3 } from "../../shared/math.js";
import {
	type CharacterInput,
	type CharacterState,
	createCharacterState,
	DEFAULT_MODIFIERS,
	stepCharacter,
} from "../../shared/physics/character.js";
import type { ServerToClientEvents } from "../../shared/protocol/events.js";
import type {
	ClientStateMessage,
	ForcedMove,
	GameEvent,
} from "../../shared/protocol/game.js";

export interface RecordedMessage {
	target: string | "all";
	event: keyof ServerToClientEvents;
	payload: unknown;
}

export class RecordingTransport implements MatchTransport {
	readonly messages: RecordedMessage[] = [];
	readonly events: GameEvent[] = [];
	readonly forcedMoves: ForcedMove[] = [];
	onForcedMove: ((move: ForcedMove) => void) | null = null;

	broadcast<E extends keyof ServerToClientEvents>(
		event: E,
		...args: Parameters<ServerToClientEvents[E]>
	): void {
		this.record("all", event, args[0]);
	}

	broadcastVolatile<E extends keyof ServerToClientEvents>(
		event: E,
		...args: Parameters<ServerToClientEvents[E]>
	): void {
		if (event !== "game:snapshot") {
			this.record("all", event, args[0]);
		}
	}

	toPlayer<E extends keyof ServerToClientEvents>(
		playerId: string,
		event: E,
		...args: Parameters<ServerToClientEvents[E]>
	): void {
		this.record(playerId, event, args[0]);
	}

	private record(
		target: string,
		event: keyof ServerToClientEvents,
		payload: unknown,
	): void {
		this.messages.push({ target, event, payload });
		if (event === "game:events") {
			this.events.push(...(payload as { events: GameEvent[] }).events);
		}
		if (event === "game:forcedMove") {
			const move = payload as ForcedMove;
			this.forcedMoves.push(move);
			this.onForcedMove?.(move);
		}
	}

	eventsOfType<T extends GameEvent["type"]>(
		type: T,
	): Extract<GameEvent, { type: T }>[] {
		return this.events.filter(
			(event): event is Extract<GameEvent, { type: T }> => event.type === type,
		);
	}
}

export class ManualClock {
	time = 10_000;

	now = (): number => this.time;

	advance(ms: number): void {
		this.time += ms;
	}
}

export interface SimulatedPlayer {
	id: string;
	character: CharacterState;
	input: CharacterInput;
	seq: number;
	moveAck: number;
	voiceLevel: number;
	voicePeakMs: number;
	held: number;
	lantern: boolean;
	grimoire: boolean;
	pitch: number;
}

export interface SimulationOptions {
	seed?: number;
	config?: Partial<MatchConfig>;
	players?: number;
	teams?: (number | null)[];
	dev?: boolean;
	tutorial?: boolean;
}

export class MatchSimulation {
	readonly clock = new ManualClock();
	readonly transport = new RecordingTransport();
	readonly match: Match;
	readonly bots = new Map<string, SimulatedPlayer>();
	results: unknown = undefined;

	constructor(options: SimulationOptions = {}) {
		const count = options.players ?? 2;
		const participants = Array.from({ length: count }, (_, index) => ({
			id: `p${index + 1}`,
			name: `Testeur ${index + 1}`,
			color: 0xffffff,
			team: options.teams?.[index] ?? null,
		}));
		this.match = new Match({
			id: "m_test",
			seed: options.seed ?? 12345,
			config: { ...PUBLIC_MATCH_CONFIG, ...options.config },
			participants,
			transport: this.transport,
			previousWords: new Set(),
			clock: this.clock.now,
			onFinished: (results) => {
				this.results = results;
			},
			autoStart: false,
			dev: options.dev ?? false,
			tutorial: options.tutorial ?? false,
		});
		for (const player of this.match.players.values()) {
			this.bots.set(player.id, {
				id: player.id,
				character: createCharacterState(
					player.position.x,
					player.position.y,
					player.position.z,
				),
				input: {
					forward: 0,
					strafe: 0,
					yaw: player.yaw,
					sprint: false,
					crouch: false,
					jump: false,
				},
				seq: 0,
				moveAck: 0,
				voiceLevel: 0,
				voicePeakMs: 0,
				held: -1,
				lantern: false,
				grimoire: false,
				pitch: 0,
			});
		}
		this.transport.onForcedMove = (move) => {
			const bot = this.bots.get(move.playerId);
			if (bot) {
				bot.character.x = move.x;
				bot.character.y = move.y;
				bot.character.z = move.z;
				bot.character.vx = 0;
				bot.character.vz = 0;
				bot.moveAck = move.moveId;
				if (move.yaw !== null) {
					bot.input.yaw = move.yaw;
				}
			}
		};
		for (const player of this.match.players.values()) {
			this.match.playerLoaded(player.id);
		}
		this.match.step(this.clock.now());
	}

	bot(id: string): SimulatedPlayer {
		return this.bots.get(id) as SimulatedPlayer;
	}

	teleportBot(id: string, position: Vec3, yaw?: number): void {
		const player = this.match.players.get(id);
		if (!player) {
			throw new Error(`Player ${id} not found`);
		}
		this.match.forcedMove(player, "spawn", position, yaw ?? null, 0);
	}

	run(seconds: number, everyTick?: (time: number) => void): void {
		const ticks = Math.round((seconds * 1000) / SERVER_TICK_MS);
		for (let i = 0; i < ticks; i += 1) {
			this.clock.advance(SERVER_TICK_MS);
			everyTick?.(this.clock.time);
			this.simulateClients(SERVER_TICK_MS / 1000);
			if (this.match.phase === "ended") {
				return;
			}
			this.match.step(this.clock.now());
		}
	}

	private simulateClients(dt: number): void {
		for (const bot of this.bots.values()) {
			const player = this.match.players.get(bot.id);
			if (!player) {
				throw new Error(`Player ${bot.id} not found`);
			}

			if (player.alive && !player.hidden && !player.carried) {
				const substeps = 4;
				for (let index = 0; index < substeps; index += 1) {
					stepCharacter(
						this.match.world,
						bot.character,
						bot.input,
						{
							...DEFAULT_MODIFIERS,
							sprintAllowed: !player.sprintLocked,
							fly: player.devModes.fly,
							passThrough: player.devModes.passThrough,
						},
						dt / substeps,
					);
				}
			}
			if (bot.lantern !== player.lanternOpen) {
				this.match.handleLantern(bot.id, bot.lantern);
			}
			bot.seq += 1;
			const message: ClientStateMessage = {
				seq: bot.seq,
				x: bot.character.x,
				y: bot.character.y,
				z: bot.character.z,
				yaw: bot.input.yaw,
				pitch: bot.pitch,
				vx: bot.character.vx,
				vy: bot.character.vy,
				vz: bot.character.vz,
				grounded: bot.character.grounded,
				crouch: bot.character.crouch,
				sprint: bot.input.sprint,
				moveInput:
					Math.abs(bot.input.forward) > 0 || Math.abs(bot.input.strafe) > 0,
				grimoire: bot.grimoire,
				voiceLevel: bot.voiceLevel,
				voicePeakMs: bot.voicePeakMs,
				held: bot.held,
				moveAck: bot.moveAck,
			};
			this.match.handleClientState(bot.id, message);
		}
	}
}
