import { ARCHIVIST_CIRCLE_RADIUS, BLOAT_RADIUS } from '../../../shared/config/index.js';
import { lookDirection, type Vec3 } from '../../../shared/math.js';
import { distanceToPolygonBoundary } from '../../../shared/manor/polygon.js';
import type { ManorLayout, Room, RoomType } from '../../../shared/manor/types.js';
import type { NavGrid } from '../../../shared/navigation/navGrid.js';
import { lineOfSight } from '../../../shared/physics/lineOfSight.js';
import type { SeededRandom } from '../../../shared/random.js';
import type { SpawnPoint } from '../../../shared/protocol/game.js';
import type { AnomalyEntity } from '../ai/AnomalyEntity.js';
import type { MatchPlayer } from '../MatchPlayer.js';

export interface SpawnContext {
  layout: ManorLayout;
  grid: NavGrid;
  rng: SeededRandom;
  players: MatchPlayer[];
  anomalies: AnomalyEntity[];
  dangerZones: { center: Vec3; radius: number }[];
}

const EXCLUDED_PLAYER_ROOMS: RoomType[] = ['stairwell', 'toilets', 'closet'];
const SPACIOUS_ANOMALY_COUNT = 3;
const ARCHIVIST_ROOMS: RoomType[] = [
  'hall',
  'library',
  'ritual',
  'dining',
  'salon',
  'music',
  'gallery',
  'chapel',
  'alchemy',
  'curiosities',
  'observatory',
  'crypt',
];

function spawnCells(grid: NavGrid, room: Room): number[] {
  return (grid.roomCells.get(room.id) ?? []).filter(
    (node) => grid.isInMainComponent(node) && Math.abs(grid.heights[node]! - room.floorY) < 0.05,
  );
}

function roomCenterYaw(room: Room, position: Vec3): number {
  const dx = room.labelPoint.x - position.x;
  const dz = room.labelPoint.z - position.z;
  if (Math.hypot(dx, dz) < 0.5) {
    return 0;
  }
  return Math.atan2(-dx, -dz);
}

function preferCentralCell(grid: NavGrid, room: Room, cells: number[], rng: SeededRandom): number {
  const scored = cells
    .map((node) => {
      const position = grid.nodePosition(node);
      return {
        node,
        score:
          Math.hypot(position.x - room.labelPoint.x, position.z - room.labelPoint.z) +
          rng.next() * 1.5,
      };
    })
    .sort((a, b) => a.score - b.score);
  return scored[Math.min(scored.length - 1, rng.int(0, Math.min(4, scored.length - 1)))]!.node;
}

export function pickPlayerSpawns(context: SpawnContext, count: number): SpawnPoint[] {
  const { layout, grid, rng } = context;
  const rooms = rng.shuffle(
    layout.rooms.filter(
      (room) => !EXCLUDED_PLAYER_ROOMS.includes(room.type) && spawnCells(grid, room).length >= 6,
    ),
  );
  const preferred = [
    ...rooms.filter((room) => room.type !== 'corridor'),
    ...rooms.filter((room) => room.type === 'corridor'),
  ];
  const spawns: SpawnPoint[] = [];
  const usedRooms: Room[] = [];
  for (const room of preferred) {
    if (spawns.length >= count) {
      break;
    }
    if (
      usedRooms.some(
        (used) =>
          Math.hypot(used.labelPoint.x - room.labelPoint.x, used.labelPoint.z - room.labelPoint.z) <
          9,
      )
    ) {
      continue;
    }
    const node = preferCentralCell(grid, room, spawnCells(grid, room), rng);
    const position = grid.nodePosition(node);
    spawns.push({
      x: position.x,
      y: position.y,
      z: position.z,
      yaw: roomCenterYaw(room, position),
    });
    usedRooms.push(room);
  }
  for (const room of preferred) {
    if (spawns.length >= count) {
      break;
    }
    if (usedRooms.includes(room)) {
      continue;
    }
    const node = preferCentralCell(grid, room, spawnCells(grid, room), rng);
    const position = grid.nodePosition(node);
    spawns.push({
      x: position.x,
      y: position.y,
      z: position.z,
      yaw: roomCenterYaw(room, position),
    });
    usedRooms.push(room);
  }
  return spawns;
}

function isSafeForPlayer(context: SpawnContext, position: Vec3, self: MatchPlayer | null): boolean {
  for (const anomaly of context.anomalies) {
    if (!anomaly.active) {
      continue;
    }
    const distance = Math.hypot(
      anomaly.position.x - position.x,
      anomaly.position.y - position.y,
      anomaly.position.z - position.z,
    );
    if (distance < 14) {
      return false;
    }
    const sees =
      anomaly.definition.hostile &&
      distance < 26 &&
      lineOfSight(context.grid.world, anomaly.eye(), { ...position, y: position.y + 1.2 });
    if (sees) {
      return false;
    }
  }
  for (const zone of context.dangerZones) {
    if (
      Math.hypot(zone.center.x - position.x, zone.center.z - position.z) < zone.radius + 1.5 &&
      Math.abs(zone.center.y - position.y) < 2
    ) {
      return false;
    }
  }
  for (const player of context.players) {
    if (player === self || !player.alive) {
      continue;
    }
    if (
      Math.hypot(player.position.x - position.x, player.position.z - position.z) <
        BLOAT_RADIUS + 1 &&
      Math.abs(player.position.y - position.y) < 2.5
    ) {
      return false;
    }
  }
  return true;
}

export function pickRespawn(context: SpawnContext, player: MatchPlayer): SpawnPoint | null {
  const { layout, grid, rng } = context;
  const rooms = rng.shuffle(
    layout.rooms.filter((room) => !EXCLUDED_PLAYER_ROOMS.includes(room.type)),
  );
  for (const strict of [true, false]) {
    for (const room of rooms) {
      const cells = rng.shuffle(spawnCells(grid, room)).slice(0, 8);
      for (const node of cells) {
        const position = grid.nodePosition(node);
        if (!strict || isSafeForPlayer(context, position, player)) {
          return {
            x: position.x,
            y: position.y,
            z: position.z,
            yaw: roomCenterYaw(room, position),
          };
        }
      }
    }
  }
  return null;
}

function hiddenFromPlayers(context: SpawnContext, position: Vec3, height: number): boolean {
  const center = { x: position.x, y: position.y + height * 0.6, z: position.z };
  for (const player of context.players) {
    if (!player.connected) {
      continue;
    }
    const eye = player.eyePosition();
    const distance = Math.hypot(eye.x - center.x, eye.y - center.y, eye.z - center.z);
    if (distance < 14) {
      return false;
    }
    if (distance > 38) {
      continue;
    }
    const look = lookDirection(player.yaw, player.pitch);
    const direction = {
      x: (center.x - eye.x) / distance,
      y: (center.y - eye.y) / distance,
      z: (center.z - eye.z) / distance,
    };
    const facing = look.x * direction.x + look.y * direction.y + look.z * direction.z;
    if (
      facing > Math.cos((75 * Math.PI) / 180) &&
      lineOfSight(context.grid.world, eye, center, { ignoreFurniture: true })
    ) {
      return false;
    }
    const top = { ...center, y: position.y + height };
    if (distance < 22 && lineOfSight(context.grid.world, eye, top)) {
      return false;
    }
  }
  return true;
}

function playerRooms(context: SpawnContext): Set<number> {
  const rooms = new Set<number>();
  for (const player of context.players) {
    if (player.roomId !== null) {
      rooms.add(player.roomId);
    }
  }
  return rooms;
}

export interface AnomalySpawnSpot {
  position: Vec3;
  yaw: number;
  roomId: number;
}

export function pickAnomalySpawn(
  context: SpawnContext,
  entity: AnomalyEntity,
): AnomalySpawnSpot | null {
  const { layout, grid, rng } = context;
  const running = context.anomalies.filter((other) => other.active).length;
  const spacing = running < SPACIOUS_ANOMALY_COUNT ? 12 : 6;
  const occupiedRooms = playerRooms(context);
  const takenArchivistRooms = new Set(
    context.anomalies
      .filter((other) => other.active && other.species === 'archiviste' && other.homeRoom !== null)
      .map((other) => other.homeRoom!),
  );
  let rooms = layout.rooms.filter(
    (room) => !occupiedRooms.has(room.id) && room.type !== 'stairwell',
  );
  if (entity.species === 'archiviste') {
    rooms = rooms.filter(
      (room) =>
        ARCHIVIST_ROOMS.includes(room.type) &&
        !takenArchivistRooms.has(room.id) &&
        room.area >= 32 &&
        distanceToPolygonBoundary(room.labelPoint, room.polygon) >= 2.4,
    );
  } else {
    rooms = rooms.filter((room) => room.type !== 'closet' && room.type !== 'toilets');
  }
  for (const room of rng.shuffle(rooms)) {
    if (entity.species === 'archiviste') {
      const position = { x: room.labelPoint.x, y: room.floorY, z: room.labelPoint.z };
      const playerInside = context.players.some((player) => player.roomId === room.id);
      if (!playerInside && hiddenFromPlayers(context, position, entity.definition.bodyHeight)) {
        return { position, yaw: rng.range(-Math.PI, Math.PI), roomId: room.id };
      }
      continue;
    }
    const cells = rng.shuffle(spawnCells(grid, room)).slice(0, 10);
    for (const node of cells) {
      const position = grid.nodePosition(node);
      const crowded = context.anomalies.some(
        (other) =>
          other.active &&
          Math.abs(other.position.y - position.y) < 2.5 &&
          Math.hypot(other.position.x - position.x, other.position.z - position.z) < spacing,
      );
      if (crowded || !hiddenFromPlayers(context, position, entity.definition.bodyHeight)) {
        continue;
      }
      return { position, yaw: roomCenterYaw(room, position), roomId: room.id };
    }
  }
  return null;
}

export function archivistDangerZones(
  anomalies: AnomalyEntity[],
  layout: ManorLayout,
): { center: Vec3; radius: number }[] {
  return anomalies
    .filter(
      (anomaly) => anomaly.active && anomaly.species === 'archiviste' && anomaly.homeRoom !== null,
    )
    .map((anomaly) => {
      const room = layout.rooms[anomaly.homeRoom!]!;
      return {
        center: { x: room.labelPoint.x, y: room.floorY, z: room.labelPoint.z },
        radius: ARCHIVIST_CIRCLE_RADIUS,
      };
    });
}
