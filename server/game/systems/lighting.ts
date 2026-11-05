import type { Level } from '../../../shared/manor/types.js';
import type { Vec3 } from '../../../shared/math.js';
import type { NavGrid } from '../../../shared/navigation/navGrid.js';
import { lineOfSight } from '../../../shared/physics/lineOfSight.js';

export class LightingMap {
  private readonly values: Float32Array;

  constructor(private readonly grid: NavGrid) {
    this.values = new Float32Array(grid.cellsPerLevel * grid.levelCount);
    this.bake();
  }

  private bake(): void {
    const { grid } = this;
    const world = grid.world;
    for (const light of world.layout.lights) {
      const radiusCells = Math.ceil(light.radius / grid.cellSize);
      const level = light.level;
      const center = grid.cellNode(level, light.position);
      const stairCenter =
        level > 0 ? grid.cellNode((level - 1) as Level, light.position) : null;
      for (const origin of [center, stairCenter]) {
        if (origin === null) {
          continue;
        }
        const originLevel = Math.floor(origin / grid.cellsPerLevel);
        const index = origin - originLevel * grid.cellsPerLevel;
        const column = index % grid.columns;
        const row = (index - column) / grid.columns;
        for (let dr = -radiusCells; dr <= radiusCells; dr += 1) {
          for (let dc = -radiusCells; dc <= radiusCells; dc += 1) {
            const r = row + dr;
            const c = column + dc;
            if (r < 0 || c < 0 || r >= grid.rows || c >= grid.columns) {
              continue;
            }
            const node = originLevel * grid.cellsPerLevel + r * grid.columns + c;
            if (!grid.walkable[node]) {
              continue;
            }
            const position = grid.nodePosition(node);
            const distance = Math.hypot(
              position.x - light.position.x,
              position.z - light.position.z,
              position.y + 1 - light.position.y,
            );
            if (distance > light.radius) {
              continue;
            }
            if (
              !lineOfSight(
                world,
                light.position,
                { x: position.x, y: position.y + 1, z: position.z },
                { ignoreFurniture: true },
              )
            ) {
              continue;
            }
            const falloff = (1 - distance / light.radius) ** 2;
            this.values[node] = Math.min(
              2,
              (this.values[node] ?? 0) + light.intensity * falloff * 1.4,
            );
          }
        }
      }
    }
  }

  staticAt(position: Vec3): number {
    const node = this.grid.nearestNode(position, 1, false);
    if (node === null) {
      return 0;
    }
    return this.values[node] ?? 0;
  }
}
