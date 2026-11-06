import {
  ARCHIVIST_PULL_SPEED,
  DEV_FLY_FAST_SPEED,
  DEV_MOVEMENT_BUDGET_CAP,
  FALL_DAMAGE_PER_METER,
  FALL_SAFE_HEIGHT,
  JUMP_ENERGY_COST,
  JUMP_VELOCITY,
  PLAYER_HEAD_CLEARANCE,
  MOVEMENT_BUDGET_CAP,
  SPRINT_GRACE_MS,
  SPRINT_SPEED,
  WALK_SPEED,
  OCCULT_IDS,
} from '../../../shared/config/index.js';
import { movesFreely } from '../../../shared/devModes.js';
import { movementCrossesWall } from '../../../shared/physics/lineOfSight.js';
import type { ClientStateMessage } from '../../../shared/protocol/game.js';
import type { Match } from '../Match.js';
import type { MatchPlayer } from '../MatchPlayer.js';
import { drainEnergy } from './energy.js';

const JUMP_DETECT_SPEED = JUMP_VELOCITY * 0.6;

export type StateOutcome = 'accepted' | 'look-only' | 'stale' | 'rejected';

export function applyClientState(
  match: Match,
  player: MatchPlayer,
  message: ClientStateMessage,
): StateOutcome {
  if (message.seq <= player.lastSeq) {
    return 'stale';
  }
  player.lastSeq = message.seq;
  player.held = OCCULT_IDS[message.held] ?? null;
  const now = match.now;
  const elapsedMs = Math.min(1000, Math.max(16, now - player.lastStateAt));
  player.lastStateAt = now;
  if (player.alive) {
    player.yaw = message.yaw;
    player.pitch = message.pitch;
  }
  player.grimoireOpen = message.grimoire;
  player.recordVoice({
    t: now,
    level: message.voiceLevel,
    activeMs: Math.min(message.voicePeakMs, elapsedMs + 60),
  });

  if (
    !player.alive ||
    player.hidden ||
    player.carried ||
    message.moveAck < player.lastForcedMoveId
  ) {
    player.moveInput = false;
    player.sprintIntent = false;
    return 'look-only';
  }

  if (player.petrifiedUntil > now) {
    player.moveInput = false;
    player.sprintIntent = false;
    if (Math.hypot(message.x - player.position.x, message.z - player.position.z) > 0.2) {
      match.correctPlayer(player);
      return 'rejected';
    }
    return 'look-only';
  }

  const dt = elapsedMs / 1000;
  const previous = player.position;
  const next = { x: message.x, y: message.y, z: message.z };
  const pull = match.pullOn(player);
  const sprintAllowed =
    !player.sprintLocked || now - match.sprintLockedAt(player) < SPRINT_GRACE_MS;
  const free = movesFreely(player.devModes);
  const maxSpeed =
    (player.devModes.fly ? DEV_FLY_FAST_SPEED : sprintAllowed ? SPRINT_SPEED : WALK_SPEED) +
    Math.hypot(pull.x, pull.z);
  player.movementBudget = Math.min(
    free ? DEV_MOVEMENT_BUDGET_CAP : MOVEMENT_BUDGET_CAP,
    player.movementBudget + maxSpeed * dt * 1.2 + 0.08,
  );
  const horizontal = Math.hypot(next.x - previous.x, next.z - previous.z);
  const vertical = next.y - previous.y;
  const recentDoors = match.doors.recentlyChanged(now, 1600);
  const valid =
    horizontal <= player.movementBudget &&
    (player.devModes.fly || vertical <= 1.4) &&
    (free || match.world.regionAt({ x: next.x, z: next.z }, next.y, 0.8) !== null) &&
    (player.devModes.passThrough ||
      !movementCrossesWall(
        match.world,
        previous,
        next,
        Math.min(player.bodyHeight(), PLAYER_HEAD_CLEARANCE),
        recentDoors,
      ));
  if (!valid) {
    match.correctPlayer(player);
    return 'rejected';
  }
  player.movementBudget -= horizontal;

  if (!player.devModes.fly && player.grounded && !message.grounded && message.vy > JUMP_DETECT_SPEED) {
    drainEnergy(player, JUMP_ENERGY_COST);
  }
  player.position = next;
  player.velocity = { x: message.vx, y: message.vy, z: message.vz };
  player.grounded = message.grounded;
  trackFall(match, player, previous.y, free);
  player.crouch = message.crouch;
  player.sprintIntent = message.sprint && sprintAllowed;
  player.moveInput = message.moveInput;
  player.history.push({ t: now, x: next.x, y: next.y, z: next.z, yaw: message.yaw });
  return 'accepted';
}

function trackFall(match: Match, player: MatchPlayer, previousY: number, free: boolean): void {
  if (free) {
    player.fallPeakY = null;
    return;
  }
  if (!player.grounded) {
    player.fallPeakY = Math.max(player.fallPeakY ?? previousY, player.position.y);
    return;
  }
  const peak = player.fallPeakY;
  player.fallPeakY = null;
  if (peak === null) {
    return;
  }
  const drop = peak - player.position.y;
  if (drop > FALL_SAFE_HEIGHT) {
    match.applyFallDamage(player, Math.round((drop - FALL_SAFE_HEIGHT) * FALL_DAMAGE_PER_METER));
  }
}

export function archivistPullVector(match: Match, player: MatchPlayer): { x: number; z: number } {
  if (!player.active || player.roomId === null) {
    return { x: 0, z: 0 };
  }
  for (const anomaly of match.anomalies) {
    if (!anomaly.active || anomaly.species !== 'archiviste' || anomaly.homeRoom !== player.roomId) {
      continue;
    }
    const dx = anomaly.position.x - player.position.x;
    const dz = anomaly.position.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.4) {
      return { x: 0, z: 0 };
    }
    return { x: (dx / distance) * ARCHIVIST_PULL_SPEED, z: (dz / distance) * ARCHIVIST_PULL_SPEED };
  }
  return { x: 0, z: 0 };
}
