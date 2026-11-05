import { doorGeometry } from '../../../shared/manor/doors.js';
import type { ManorLayout } from '../../../shared/manor/types.js';
import type { Vec3 } from '../../../shared/math.js';
import type { CollisionWorld } from '../../../shared/physics/collisionWorld.js';

export interface DoorState {
  id: number;
  openingId: number;
  open: boolean;
  changedAt: number;
  center: Vec3;
}

export class DoorSystem {
  readonly doors: DoorState[] = [];

  constructor(
    layout: ManorLayout,
    private readonly world: CollisionWorld,
  ) {
    for (const opening of layout.openings) {
      if (!opening.door) {
        continue;
      }
      const geometry = doorGeometry(opening);
      this.doors[opening.door.id] = {
        id: opening.door.id,
        openingId: opening.id,
        open: opening.door.initiallyOpen,
        changedAt: -Infinity,
        center: { x: geometry.center.x, y: opening.floorY + 1.1, z: geometry.center.z },
      };
      world.setDoorClosed(opening.door.id, !opening.door.initiallyOpen);
    }
  }

  get(doorId: number): DoorState | null {
    return this.doors[doorId] ?? null;
  }

  isClosed(doorId: number): boolean {
    const door = this.doors[doorId];
    return door ? !door.open : false;
  }

  setOpen(doorId: number, open: boolean, now: number): boolean {
    const door = this.doors[doorId];
    if (!door || door.open === open) {
      return false;
    }
    door.open = open;
    door.changedAt = now;
    this.world.setDoorClosed(doorId, !open);
    return true;
  }

  recentlyChanged(now: number, windowMs: number): Set<number> {
    const result = new Set<number>();
    for (const door of this.doors) {
      if (door && now - door.changedAt < windowMs) {
        result.add(door.id);
      }
    }
    return result;
  }

  states(): { id: number; open: boolean }[] {
    return this.doors.filter(Boolean).map((door) => ({ id: door.id, open: door.open }));
  }
}
