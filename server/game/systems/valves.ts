import {
  HEALTH_MAX,
  VALVE_COOLDOWN_MS,
  VALVE_HEAL_PER_SECOND,
  VALVE_HEAL_RADIUS,
  VALVE_JET_DURATION_MS,
} from '../../../shared/config/index.js';
import type { ValveStation } from '../../../shared/manor/types.js';
import type { MatchPlayer } from '../MatchPlayer.js';

export interface ValveState {
  station: ValveStation;
  activeUntil: number;
  cooldownUntil: number;
}

export class ValveSystem {
  readonly valves: ValveState[];

  constructor(stations: ValveStation[]) {
    this.valves = stations.map((station) => ({ station, activeUntil: 0, cooldownUntil: 0 }));
  }

  activate(valveId: number, now: number): ValveState | null {
    const valve = this.valves[valveId];
    if (!valve || now < valve.cooldownUntil || now < valve.activeUntil) {
      return null;
    }
    valve.activeUntil = now + VALVE_JET_DURATION_MS;
    valve.cooldownUntil = valve.activeUntil + VALVE_COOLDOWN_MS;
    return valve;
  }

  isInJet(player: MatchPlayer, valve: ValveState, now: number): boolean {
    if (now >= valve.activeUntil) {
      return false;
    }
    const station = valve.station;
    const horizontal = Math.hypot(
      player.position.x - station.jet.x,
      player.position.z - station.jet.z,
    );
    const feet = player.position.y - station.floorY;
    return horizontal <= VALVE_HEAL_RADIUS && feet > -0.3 && feet < 1.6;
  }

  heal(players: Iterable<MatchPlayer>, now: number, dt: number): void {
    for (const player of players) {
      if (!player.alive || player.hidden || player.carried || player.health >= HEALTH_MAX) {
        continue;
      }
      if (this.valves.some((valve) => this.isInJet(player, valve, now))) {
        player.health = Math.min(HEALTH_MAX, player.health + VALVE_HEAL_PER_SECOND * dt);
      }
    }
  }
}
