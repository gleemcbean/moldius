import {
  CAPTURE_VOICE_ACTIVITY_LEVEL,
  CAPTURE_VOICE_ACTIVITY_MS,
  CAPTURE_VOICE_WINDOW_MS,
  HOWLER_BLOCK_RADIUS,
} from '../../../shared/config/index.js';
import { transcriptMatchesFormula } from '../../../shared/anomalies/formulas.js';
import type { Vec3 } from '../../../shared/math.js';
import { countWallsBetween, lineOfSight } from '../../../shared/physics/lineOfSight.js';
import type { CastFailureReason, CastRequest, CastResult } from '../../../shared/protocol/game.js';
import type { AnomalyEntity } from '../ai/AnomalyEntity.js';
import type { Match } from '../Match.js';
import type { MatchPlayer } from '../MatchPlayer.js';

const MESSAGES: Record<CastFailureReason, string> = {
  'wrong-words': 'Aucune anomalie présente ne répond à cette formule.',
  'out-of-range': 'Trop loin : rapprochez-vous.',
  blocked: "Un obstacle coupe la ligne vers l'anomalie.",
  'lantern-open-required': 'Il faut ouvrir la lanterne.',
  'lantern-closed-required': 'Il faut fermer la lanterne.',
  'missing-occult': "Tenez en main l'objet occulte de cette anomalie.",
  'howler-scream': 'Le cri du Hurleur couvre votre voix !',
  interrupted: 'Incantation interrompue : reprenez votre souffle.',
  'no-voice': 'Aucune voix détectée : prononcez la formule à voix haute.',
  dead: 'Vous êtes hors de combat.',
  hidden: "Impossible d'incanter depuis une cachette.",
  cooldown: 'Patientez un instant.',
  scattered: 'Le Roi de rats est éparpillé : attendez qu\'il se reforme.',
};

export function failure(anomalyId: number, reason: CastFailureReason): CastResult {
  return { ok: false, anomalyId, reason, message: MESSAGES[reason], points: 0 };
}

export function validateCast(match: Match, player: MatchPlayer, request: CastRequest): CastResult {
  const now = match.now;
  if (!player.alive || player.carried) {
    return failure(-1, 'dead');
  }
  if (player.hidden) {
    return failure(-1, 'hidden');
  }
  if (player.castBlockedUntil > now || !player.casting) {
    return failure(-1, 'interrupted');
  }
  if (
    player.voiceActivitySince(now - CAPTURE_VOICE_WINDOW_MS, CAPTURE_VOICE_ACTIVITY_LEVEL) <
    CAPTURE_VOICE_ACTIVITY_MS
  ) {
    return failure(-1, 'no-voice');
  }
  const eye = player.eyePosition();
  const candidates = match.anomalies
    .filter(
      (entity) =>
        entity.active &&
        request.transcripts.some((transcript) =>
          transcriptMatchesFormula(transcript, entity.formula),
        ),
    )
    .map((entity) => ({ entity, distance: distanceTo(eye, bodyPoint(entity, 0.55)) }))
    .sort((a, b) => a.distance - b.distance);
  let refusal: CastResult | null = null;
  for (const { entity, distance } of candidates) {
    const reason =
      checkGeometry(match, eye, entity, distance) ??
      checkSpeciesRules(player, entity) ??
      (entity.species !== 'hurleur' && howlerBlocks(match, player) ? 'howler-scream' : null);
    if (reason === null) {
      return {
        ok: true,
        anomalyId: entity.id,
        reason: null,
        message: `${entity.definition.name} capturé !`,
        points: entity.definition.points,
      };
    }
    refusal ??= failure(entity.id, reason);
  }
  return refusal ?? failure(-1, 'wrong-words');
}

function bodyPoint(entity: AnomalyEntity, height: number): Vec3 {
  const base = entity.position;
  return { x: base.x, y: base.y + entity.definition.bodyHeight * height, z: base.z };
}

function distanceTo(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function checkGeometry(
  match: Match,
  eye: Vec3,
  entity: AnomalyEntity,
  distance: number,
): CastFailureReason | null {
  const rules = entity.definition.capture;
  if (distance > rules.maxRange + 0.35) {
    return 'out-of-range';
  }
  const visible = [0.55, 0.9, 0.2].some((height) =>
    lineOfSight(match.world, eye, bodyPoint(entity, height), { ignoreFurniture: false, blockGlass: true }),
  );
  return visible ? null : 'blocked';
}

function checkSpeciesRules(player: MatchPlayer, entity: AnomalyEntity): CastFailureReason | null {
  const rules = entity.definition.capture;
  if (rules.lantern === 'open' && !player.lanternOpen) {
    return 'lantern-open-required';
  }
  if (rules.lantern === 'closed' && player.lanternOpen) {
    return 'lantern-closed-required';
  }
  if (entity.occult && (player.held !== entity.occult || player.objects[entity.occult] < 1)) {
    return 'missing-occult';
  }
  return null;
}

export function howlerBlocks(match: Match, player: MatchPlayer): boolean {
  const ear = player.eyePosition();
  for (const howler of match.anomalies) {
    if (!howler.active || howler.species !== 'hurleur' || howler.screamUntil < match.now - 400) {
      continue;
    }
    const mouth = howler.center();
    const distance = Math.hypot(mouth.x - ear.x, mouth.y - ear.y, mouth.z - ear.z);
    if (distance > HOWLER_BLOCK_RADIUS) {
      continue;
    }
    const walls = countWallsBetween(match.world, mouth, ear, 3);
    if (distance <= HOWLER_BLOCK_RADIUS / (1 + walls)) {
      return true;
    }
  }
  return false;
}
