import {
  PLAYER_HIT_RADIUS,
  PROJECTILE_LIFETIME_MS,
  SLIME_GROUND_CONTACT_HEIGHT,
  SLIME_PUDDLE_DURATION_MS,
  SLIME_PUDDLE_RADIUS,
} from '../../../shared/config/index.js';
import type { Vec3 } from '../../../shared/math.js';
import { supportHeight } from '../../../shared/physics/character.js';
import type { CollisionWorld } from '../../../shared/physics/collisionWorld.js';
import { lineOfSight } from '../../../shared/physics/lineOfSight.js';
import type { ProjectileKind } from '../../../shared/protocol/game.js';
import type { MatchPlayer } from '../MatchPlayer.js';

export interface Puddle {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  expiresAt: number;
}

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  origin: Vec3;
  velocity: Vec3;
  gravity: number;
  launchedAt: number;
  ownerId: number;
  previous: Vec3;
}

export type ProjectileOutcome = {
  projectile: Projectile;
  at: Vec3;
  player: MatchPlayer | null;
  ground: Vec3 | null;
};

export function ballisticVelocity(from: Vec3, to: Vec3, speed: number, gravity: number): Vec3 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const horizontal = Math.hypot(dx, dz);
  const time = Math.max(0.25, horizontal / speed);
  return {
    x: dx / time,
    y: (to.y - from.y + 0.5 * gravity * time * time) / time,
    z: dz / time,
  };
}

export function projectilePosition(projectile: Projectile, now: number): Vec3 {
  const t = Math.max(0, now - projectile.launchedAt) / 1000;
  return {
    x: projectile.origin.x + projectile.velocity.x * t,
    y: projectile.origin.y + projectile.velocity.y * t - 0.5 * projectile.gravity * t * t,
    z: projectile.origin.z + projectile.velocity.z * t,
  };
}

export class HazardSystem {
  readonly puddles: Puddle[] = [];
  readonly projectiles: Projectile[] = [];
  private nextId = 1;

  constructor(private readonly world: CollisionWorld) {}

  launch(
    kind: ProjectileKind,
    origin: Vec3,
    velocity: Vec3,
    gravity: number,
    now: number,
    ownerId: number,
  ): Projectile {
    const projectile: Projectile = {
      id: this.nextId++,
      kind,
      origin: { ...origin },
      velocity,
      gravity,
      launchedAt: now,
      ownerId,
      previous: { ...origin },
    };
    this.projectiles.push(projectile);
    return projectile;
  }

  stepProjectiles(players: Iterable<MatchPlayer>, now: number): ProjectileOutcome[] {
    const outcomes: ProjectileOutcome[] = [];
    const candidates = [...players].filter(
      (player) => player.alive && !player.hidden && !player.carried,
    );
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index]!;
      const current = projectilePosition(projectile, now);
      const outcome = this.checkSegment(projectile, projectile.previous, current, candidates, now);
      if (outcome) {
        outcomes.push(outcome);
        this.projectiles.splice(index, 1);
        continue;
      }
      projectile.previous = current;
    }
    return outcomes;
  }

  private checkSegment(
    projectile: Projectile,
    from: Vec3,
    to: Vec3,
    players: MatchPlayer[],
    now: number,
  ): ProjectileOutcome | null {
    const radius = projectile.kind === 'ember' ? 0.22 : 0.28;
    for (const player of players) {
      const hit = segmentNearPlayer(from, to, player, radius + PLAYER_HIT_RADIUS);
      const body = hit && { x: player.position.x, y: hit.y, z: player.position.z };
      if (hit && body && lineOfSight(this.world, from, body, { ignoreFurniture: true, blockGlass: true })) {
        const ground = { x: player.position.x, y: player.position.y, z: player.position.z };
        return { projectile, at: hit, player, ground };
      }
    }
    if (!lineOfSight(this.world, from, to, { ignoreFurniture: false, blockGlass: true })) {
      return { projectile, at: from, player: null, ground: this.groundBelow(from) };
    }
    const support = supportHeight(this.world, to.x, to.z, from.y, 0.05);
    if (support.height !== null && to.y <= support.height) {
      return {
        projectile,
        at: { x: to.x, y: support.height, z: to.z },
        player: null,
        ground: { x: to.x, y: support.height, z: to.z },
      };
    }
    if (now - projectile.launchedAt > PROJECTILE_LIFETIME_MS || to.y < -5) {
      return { projectile, at: to, player: null, ground: null };
    }
    return null;
  }

  private groundBelow(point: Vec3): Vec3 | null {
    const support = supportHeight(this.world, point.x, point.z, point.y, 0.2);
    if (support.height === null) {
      return null;
    }
    return { x: point.x, y: support.height, z: point.z };
  }

  addPuddle(position: Vec3, now: number): Puddle {
    const puddle: Puddle = {
      id: this.nextId++,
      x: position.x,
      y: position.y,
      z: position.z,
      radius: SLIME_PUDDLE_RADIUS,
      expiresAt: now + SLIME_PUDDLE_DURATION_MS,
    };
    this.puddles.push(puddle);
    return puddle;
  }

  expirePuddles(now: number): Puddle[] {
    const expired: Puddle[] = [];
    for (let index = this.puddles.length - 1; index >= 0; index -= 1) {
      if (this.puddles[index]!.expiresAt <= now) {
        expired.push(this.puddles.splice(index, 1)[0]!);
      }
    }
    return expired;
  }

  isOnSlime(player: MatchPlayer): boolean {
    if (!player.grounded) {
      return false;
    }
    return this.puddles.some(
      (puddle) =>
        Math.abs(player.position.y - puddle.y) <= SLIME_GROUND_CONTACT_HEIGHT + 0.06 &&
        Math.hypot(player.position.x - puddle.x, player.position.z - puddle.z) <= puddle.radius,
    );
  }
}

function segmentNearPlayer(from: Vec3, to: Vec3, player: MatchPlayer, radius: number): Vec3 | null {
  const steps = 6;
  const bottom = player.position.y + 0.15;
  const top = player.position.y + player.bodyHeight() - 0.2;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    const clampedY = Math.min(top, Math.max(bottom, y));
    if (Math.hypot(x - player.position.x, y - clampedY, z - player.position.z) <= radius) {
      return { x, y: clampedY, z };
    }
  }
  return null;
}
