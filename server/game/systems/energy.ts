import {
  ENERGY_MAX,
  ENERGY_REGEN_PER_SECOND,
  ENERGY_USE_REGEN_PAUSE_SECONDS,
  LANTERN_ENERGY_COST_PER_SECOND,
  SPRINT_ENERGY_COST_PER_SECOND,
  SPRINT_RESUME_THRESHOLD,
  SPRINT_STOP_THRESHOLD,
} from '../../../shared/config/index.js';
import type { MatchPlayer } from '../MatchPlayer.js';

export interface EnergyStep {
  sprintLockedNow: boolean;
  lanternForcedClosed: boolean;
}

export function isSprintDraining(player: MatchPlayer): boolean {
  return (
    player.alive &&
    !player.hidden &&
    !player.carried &&
    player.sprintIntent &&
    player.moveInput &&
    !player.sprintLocked &&
    player.crouch < 0.5
  );
}

export function energyDrainPerSecond(player: MatchPlayer): number {
  // La potion de vigueur fait courir sans se fatiguer ; la partie l'efface quand elle expire.
  const tireless = player.brew === 'vigor';
  return (
    (isSprintDraining(player) && !tireless ? SPRINT_ENERGY_COST_PER_SECOND : 0) +
    (player.lanternOpen ? LANTERN_ENERGY_COST_PER_SECOND : 0)
  );
}

export function pauseEnergyRegen(player: MatchPlayer, seconds: number): void {
  player.energyRegenPause = Math.max(player.energyRegenPause, seconds);
}

export function stepEnergy(player: MatchPlayer, dt: number): EnergyStep {
  const result: EnergyStep = { sprintLockedNow: false, lanternForcedClosed: false };
  if (!player.alive) {
    return result;
  }
  if (player.devModes.infiniteEnergy) {
    player.energy = ENERGY_MAX;
    player.sprintLocked = false;
    return result;
  }
  const drain = energyDrainPerSecond(player);
  const regen = player.energyRegenPause > 0 ? 0 : ENERGY_REGEN_PER_SECOND;
  const delta = drain > 0 ? -drain : regen;
  if (drain > 0) {
    pauseEnergyRegen(player, ENERGY_USE_REGEN_PAUSE_SECONDS);
  } else {
    player.energyRegenPause = Math.max(0, player.energyRegenPause - dt);
  }
  player.energy = Math.min(ENERGY_MAX, Math.max(0, player.energy + delta * dt));
  if (!player.sprintLocked && player.energy <= SPRINT_STOP_THRESHOLD) {
    player.sprintLocked = true;
    result.sprintLockedNow = true;
  } else if (player.sprintLocked && player.energy >= SPRINT_RESUME_THRESHOLD) {
    player.sprintLocked = false;
  }
  if (player.lanternOpen && player.energy <= 0) {
    player.lanternOpen = false;
    result.lanternForcedClosed = true;
  }
  return result;
}

export function drainEnergy(player: MatchPlayer, amount: number): void {
  if (player.devModes.infiniteEnergy) {
    return;
  }
  player.energy = Math.max(0, player.energy - amount);
  if (player.energy <= SPRINT_STOP_THRESHOLD) {
    player.sprintLocked = true;
  }
}

export function spendEnergy(player: MatchPlayer, amount: number): boolean {
  if (player.devModes.infiniteEnergy) {
    return true;
  }
  if (player.energy < amount) {
    return false;
  }
  player.energy -= amount;
  if (player.energy <= SPRINT_STOP_THRESHOLD) {
    player.sprintLocked = true;
  }
  return true;
}
