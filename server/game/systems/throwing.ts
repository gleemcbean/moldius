import {
  COLOSSUS_THROW_MS,
  COLOSSUS_THROW_REACH,
} from '../../../shared/config/index.js';
import type { Opening } from '../../../shared/manor/types.js';
import type { Vec2, Vec3 } from '../../../shared/math.js';
import { lineOfSight } from '../../../shared/physics/lineOfSight.js';
import type { AnomalyEntity } from '../ai/AnomalyEntity.js';
import type { Match } from '../Match.js';
import type { MatchPlayer } from '../MatchPlayer.js';

interface ThrowPlan {
  landing: Vec3;
  doorId: number | null;
}

function openingMiddle(opening: Opening, far: boolean): Vec2 {
  const depth = far ? opening.depth : 0;
  return {
    x: (opening.start.x + opening.end.x) / 2 + opening.normal.x * depth,
    z: (opening.start.z + opening.end.z) / 2 + opening.normal.z * depth,
  };
}

function landingIn(
  match: Match,
  roomId: number,
  entry: Vec2,
  inward: Vec2,
  floorY: number,
): Vec3 | null {
  const target = { x: entry.x + inward.x * 2.6, z: entry.z + inward.z * 2.6 };
  let best: Vec3 | null = null;
  let bestScore = Infinity;
  for (const node of match.grid.roomCells.get(roomId) ?? []) {
    if (!match.grid.isInMainComponent(node)) {
      continue;
    }
    const position = match.grid.nodePosition(node);
    if (Math.abs(position.y - floorY) > 0.4) {
      continue;
    }
    const fromEntry = Math.hypot(position.x - entry.x, position.z - entry.z);
    if (fromEntry < 1.2 || fromEntry > 4.5) {
      continue;
    }
    const score = Math.hypot(position.x - target.x, position.z - target.z);
    if (score < bestScore) {
      bestScore = score;
      best = position;
    }
  }
  return best;
}

function planThrow(
  match: Match,
  entity: AnomalyEntity,
  player: MatchPlayer,
): ThrowPlan | null {
  return throwThroughOpening(match, entity, player, true) ?? throwThroughOpening(match, entity, player, false);
}

function throwThroughOpening(
  match: Match,
  entity: AnomalyEntity,
  player: MatchPlayer,
  needSight: boolean,
): ThrowPlan | null {
  const roomId = match.roomIdAt(player.position);
  if (roomId === null) {
    return null;
  }
  const room = match.layout.rooms[roomId];
  const away = {
    x: player.position.x - entity.position.x,
    z: player.position.z - entity.position.z,
  };
  const length = Math.hypot(away.x, away.z) || 1;
  const direction = { x: away.x / length, z: away.z / length };
  const chest = { ...player.position, y: player.position.y + 1 };
  const options: { plan: ThrowPlan; score: number }[] = [];
  for (const openingId of room.openingIds) {
    const opening = match.layout.openings[openingId];
    const fromA = opening.roomA === roomId;
    const otherId = fromA ? opening.roomB : opening.roomA;
    const other = match.layout.rooms[otherId];
    if (
      opening.kind === 'window' ||
      other.type === 'stairwell' ||
      room.type === 'stairwell' ||
      other.level !== room.level ||
      Math.abs(opening.floorY - player.position.y) > 0.5
    ) {
      continue;
    }
    const near = openingMiddle(opening, !fromA);
    const far = openingMiddle(opening, fromA);
    const toOpening = {
      x: near.x - player.position.x,
      z: near.z - player.position.z,
    };
    const distance = Math.hypot(toOpening.x, toOpening.z);
    if (distance > COLOSSUS_THROW_REACH) {
      continue;
    }
    if (
      needSight &&
      distance > 0.5 &&
      !lineOfSight(
        match.world,
        chest,
        { x: near.x, y: opening.floorY + 1, z: near.z },
        {
          ignoreFurniture: true,
          ignoreDoors: true,
          blockGlass: true,
        },
      )
    ) {
      continue;
    }
    const inward = fromA
      ? opening.normal
      : { x: -opening.normal.x, z: -opening.normal.z };
    const landing = landingIn(match, otherId, far, inward, other.floorY);
    if (!landing) {
      continue;
    }
    const alignment =
      distance < 0.5
        ? 1
        : (toOpening.x * direction.x + toOpening.z * direction.z) / distance;
    options.push({
      plan: { landing, doorId: opening.door?.id ?? null },
      score: alignment * 2 - distance * 0.15,
    });
  }
  options.sort((first, second) => second.score - first.score);
  return options[0]?.plan ?? null;
}

function fallbackLanding(
  match: Match,
  entity: AnomalyEntity,
  player: MatchPlayer,
): Vec3 {
  const away = {
    x: player.position.x - entity.position.x,
    z: player.position.z - entity.position.z,
  };
  const length = Math.hypot(away.x, away.z) || 1;
  for (const reach of [3, 2.2, 1.4]) {
    const candidate = {
      x: player.position.x + (away.x / length) * reach,
      y: player.position.y,
      z: player.position.z + (away.z / length) * reach,
    };
    const node = match.grid.nearestNode(candidate, 1);
    if (node === null) {
      continue;
    }
    const position = match.grid.nodePosition(node);
    if (
      Math.abs(position.y - player.position.y) < 0.4 &&
      match.finder.walkableLine(
        player.position,
        position,
        match.gridLevelOf(player.position),
      )
    ) {
      return position;
    }
  }
  return { ...player.position };
}

export function throwPlayer(
  match: Match,
  entity: AnomalyEntity,
  player: MatchPlayer,
): boolean {
  const plan = planThrow(match, entity, player);
  if (
    !match.applyDamage(
      player,
      entity.definition.damage,
      entity.species,
      entity.center(),
    )
  ) {
    return false;
  }
  if (!player.alive) {
    return true;
  }
  if (
    plan?.doorId !== null &&
    plan?.doorId !== undefined &&
    match.doors.isClosed(plan.doorId)
  ) {
    match.setDoor(plan.doorId, true, `anomaly:${entity.id}`);
  }
  const landing = plan?.landing ?? fallbackLanding(match, entity, player);
  const from = { ...player.position };
  const yaw = Math.atan2(-(landing.x - from.x), -(landing.z - from.z));
  match.forcedMove(player, 'throw', landing, yaw, COLOSSUS_THROW_MS);
  player.roomId = match.roomIdAt(landing);
  match.emit({
    type: 'thrown',
    anomalyId: entity.id,
    playerId: player.id,
    from,
    to: landing,
  });
  const memory = entity.memoryFor(player.id);
  memory.awareness = 0.4;
  memory.lastSeenAt = -Infinity;
  memory.visibleNow = false;
  return true;
}
