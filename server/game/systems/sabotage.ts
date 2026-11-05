import {
  CAST_INTERRUPT_MS,
  PLAYER_RADIUS,
  PUSH_CONE_RAD,
  PUSH_COOLDOWN_MS,
  PUSH_DISTANCE,
  PUSH_DURATION_MS,
  PUSH_ENERGY_COST,
  PUSH_RANGE,
  SABOTAGE_PROTECTION_MS,
  SHOUT_COOLDOWN_MS,
  SHOUT_DURATION_MS,
  SHOUT_ENERGY_COST,
  SHOUT_RANGE,
  VOICE_SABOTAGE_COOLDOWN_MS,
  VOICE_SABOTAGE_LEVEL,
  VOICE_SABOTAGE_MARGIN,
  VOICE_SABOTAGE_RANGE,
  VOICE_SABOTAGE_SUSTAIN_MS,
} from '../../../shared/config/index.js';
import { angleDifference, type Vec3 } from '../../../shared/math.js';
import { createCharacterState, resolveHorizontal } from '../../../shared/physics/character.js';
import { lineOfSight, movementCrossesWall } from '../../../shared/physics/lineOfSight.js';
import { sameTeam } from '../../../shared/teams.js';
import { lureAnomalies } from '../ai/lure.js';
import type { Match } from '../Match.js';
import type { MatchPlayer } from '../MatchPlayer.js';
import { spendEnergy } from './energy.js';

function chest(player: MatchPlayer): Vec3 {
  return {
    x: player.position.x,
    y: player.position.y + player.bodyHeight() * 0.6,
    z: player.position.z,
  };
}

export function interruptCast(
  match: Match,
  target: MatchPlayer,
  byId: string | null,
  cause: 'push' | 'shout' | 'voice',
): boolean {
  if (!target.casting || target.sabotageProtectedUntil > match.now) {
    return false;
  }
  target.casting = null;
  target.castBlockedUntil = match.now + CAST_INTERRUPT_MS;
  target.sabotageProtectedUntil = match.now + SABOTAGE_PROTECTION_MS;
  match.emit({ type: 'castInterrupted', playerId: target.id, byId, cause });
  return true;
}

export function tryPush(match: Match, player: MatchPlayer, yaw: number): boolean {
  const now = match.now;
  if (!player.active || player.pushCooldownUntil > now || player.energy < PUSH_ENERGY_COST) {
    return false;
  }
  let best: MatchPlayer | null = null;
  let bestDistance = Infinity;
  for (const other of match.players.values()) {
    if (other === player || !other.active || sameTeam(other, player)) {
      continue;
    }
    const dx = other.position.x - player.position.x;
    const dz = other.position.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    if (
      distance > PUSH_RANGE + PLAYER_RADIUS ||
      Math.abs(other.position.y - player.position.y) > 1
    ) {
      continue;
    }
    const direction = Math.atan2(-dx, -dz);
    if (
      Math.abs(angleDifference(yaw, direction)) > PUSH_CONE_RAD ||
      !lineOfSight(match.world, chest(player), chest(other), { blockGlass: true })
    ) {
      continue;
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      best = other;
    }
  }
  if (!best || !spendEnergy(player, PUSH_ENERGY_COST)) {
    return false;
  }
  player.pushCooldownUntil = now + PUSH_COOLDOWN_MS;
  const destination = pushDestination(match, player, best);
  match.forcedMove(best, 'push', destination, null, PUSH_DURATION_MS);
  match.emit({ type: 'push', fromId: player.id, targetId: best.id });
  interruptCast(match, best, player.id, 'push');
  return true;
}

function pushDestination(match: Match, pusher: MatchPlayer, target: MatchPlayer): Vec3 {
  const dx = target.position.x - pusher.position.x;
  const dz = target.position.z - pusher.position.z;
  const length = Math.hypot(dx, dz) || 1;
  const direction = { x: dx / length, z: dz / length };
  const state = createCharacterState(target.position.x, target.position.y, target.position.z);
  state.crouch = target.crouch;
  const steps = 12;
  for (let step = 0; step < steps; step += 1) {
    const before = { x: state.x, y: state.y, z: state.z };
    state.x += (direction.x * PUSH_DISTANCE) / steps;
    state.z += (direction.z * PUSH_DISTANCE) / steps;
    resolveHorizontal(match.world, state, 1 / 60);
    const after = { x: state.x, y: state.y, z: state.z };
    if (
      movementCrossesWall(match.world, before, after, target.bodyHeight(), new Set()) ||
      !match.world.regionAt({ x: after.x, z: after.z }, after.y, 0.5)
    ) {
      state.x = before.x;
      state.z = before.z;
      break;
    }
  }
  return { x: state.x, y: state.y, z: state.z };
}

export function tryShout(match: Match, player: MatchPlayer): boolean {
  const now = match.now;
  if (
    !player.alive ||
    player.carried ||
    player.shoutCooldownUntil > now ||
    !spendEnergy(player, SHOUT_ENERGY_COST)
  ) {
    return false;
  }
  player.shoutCooldownUntil = now + SHOUT_COOLDOWN_MS;
  player.shoutingUntil = now + SHOUT_DURATION_MS;
  match.emit({ type: 'shout', playerId: player.id, ...player.position });
  match.sounds.push({
    position: { ...player.position },
    loudness: 18,
    playerId: player.id,
    kind: 'shout',
  });
  lureAnomalies(match, player.position, player.id);
  for (const other of match.players.values()) {
    if (other === player || !other.alive || other.hidden || sameTeam(other, player)) {
      continue;
    }
    const distance = Math.hypot(
      other.position.x - player.position.x,
      other.position.y - player.position.y,
      other.position.z - player.position.z,
    );
    if (
      distance <= SHOUT_RANGE &&
      lineOfSight(match.world, chest(player), chest(other), { ignoreFurniture: true, blockGlass: true })
    ) {
      interruptCast(match, other, player.id, 'shout');
    }
  }
  return true;
}

export function checkVoiceSabotage(match: Match): void {
  const now = match.now;
  const casters = [...match.players.values()].filter((player) => player.casting && player.alive);
  if (casters.length === 0) {
    return;
  }
  for (const speaker of match.players.values()) {
    if (!speaker.alive || speaker.voiceSabotageCooldownUntil > now) {
      continue;
    }
    const sustained = speaker.sustainedLevel(now, VOICE_SABOTAGE_SUSTAIN_MS);
    if (sustained < VOICE_SABOTAGE_LEVEL) {
      continue;
    }
    for (const caster of casters) {
      if (caster === speaker || sameTeam(caster, speaker)) {
        continue;
      }
      const distance = Math.hypot(
        caster.position.x - speaker.position.x,
        caster.position.y - speaker.position.y,
        caster.position.z - speaker.position.z,
      );
      if (
        distance > VOICE_SABOTAGE_RANGE ||
        !lineOfSight(match.world, chest(speaker), chest(caster), {
          ignoreFurniture: true,
          blockGlass: true,
        })
      ) {
        continue;
      }
      if (sustained < caster.voiceLevelNow(now) + VOICE_SABOTAGE_MARGIN) {
        continue;
      }
      if (interruptCast(match, caster, speaker.id, 'voice')) {
        speaker.voiceSabotageCooldownUntil = now + VOICE_SABOTAGE_COOLDOWN_MS;
      }
    }
  }
}
