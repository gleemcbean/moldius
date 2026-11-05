import { randomBytes, randomInt } from 'node:crypto';
import { PRIVATE_CODE_LENGTH } from '../../shared/config/index.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateLobbyCode(isTaken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let code = '';
    for (let index = 0; index < PRIVATE_CODE_LENGTH; index += 1) {
      code += ALPHABET[randomInt(ALPHABET.length)];
    }
    if (!isTaken(code)) {
      return code;
    }
  }
  throw new Error('Impossible de générer un code de lobby unique');
}

export function normalizeLobbyCode(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const code = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return code.length === PRIVATE_CODE_LENGTH ? code : null;
}

export function randomLobbyId(): string {
  return `l_${randomBytes(6).toString('base64url')}`;
}

export function randomMatchSeed(): number {
  return randomInt(1, 2 ** 31 - 1);
}
