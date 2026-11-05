import {
	randomBytes,
	type ScryptOptions,
	scrypt,
	timingSafeEqual,
} from "node:crypto";

export interface ScryptParameters {
	logN: number;
	r: number;
	p: number;
}

export const DEFAULT_SCRYPT: ScryptParameters = { logN: 15, r: 8, p: 3 };

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_CONCURRENT_HASHES = 2;
const MAX_QUEUED_HASHES = 64;

export class HashQueueFullError extends Error {
	constructor() {
		super("Trop de calculs de mots de passe en attente.");
	}
}

let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
	if (running >= MAX_CONCURRENT_HASHES) {
		if (waiting.length >= MAX_QUEUED_HASHES) {
			throw new HashQueueFullError();
		}
		await new Promise<void>((resolve) => waiting.push(resolve));
	}
	running += 1;
	try {
		return await work();
	} finally {
		running -= 1;
		waiting.shift()?.();
	}
}

function derive(
	password: string,
	salt: Buffer,
	parameters: ScryptParameters,
): Promise<Buffer> {
	const N = 2 ** parameters.logN;
	const options: ScryptOptions = {
		N,
		r: parameters.r,
		p: parameters.p,
		maxmem: 256 * N * parameters.r + 1024 * 1024,
	};
	return withSlot(
		() =>
			new Promise<Buffer>((resolve, reject) => {
				scrypt(
					password.normalize("NFKC"),
					salt,
					KEY_LENGTH,
					options,
					(error, key) => {
						if (error) {
							reject(error);
						} else {
							resolve(key);
						}
					},
				);
			}),
	);
}

interface ParsedHash {
	parameters: ScryptParameters;
	salt: Buffer;
	key: Buffer;
}

function parseHash(stored: string): ParsedHash | null {
	const parts = stored.split("$");
	if (parts.length !== 6 || parts[0] !== "scrypt") {
		return null;
	}
	const [logN, r, p] = parts.slice(1, 4).map(Number) as [
		number,
		number,
		number,
	];
	if (
		![logN, r, p].every(Number.isInteger) ||
		logN < 14 ||
		logN > 20 ||
		r < 1 ||
		r > 32 ||
		p < 1 ||
		p > 16
	) {
		return null;
	}
	const salt = Buffer.from(parts[4], "base64url");
	const key = Buffer.from(parts[5], "base64url");
	if (salt.length < SALT_LENGTH || key.length !== KEY_LENGTH) {
		return null;
	}
	return { parameters: { logN, r, p }, salt, key };
}

export async function hashPassword(
	password: string,
	parameters: ScryptParameters = DEFAULT_SCRYPT,
): Promise<string> {
	const salt = randomBytes(SALT_LENGTH);
	const key = await derive(password, salt, parameters);
	return [
		"scrypt",
		parameters.logN,
		parameters.r,
		parameters.p,
		salt.toString("base64url"),
		key.toString("base64url"),
	].join("$");
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const parsed = parseHash(stored);
	if (!parsed) {
		return false;
	}
	const key = await derive(password, parsed.salt, parsed.parameters);
	return timingSafeEqual(key, parsed.key);
}

export function needsRehash(
	stored: string,
	parameters: ScryptParameters,
): boolean {
	const parsed = parseHash(stored);
	return (
		!parsed ||
		parsed.parameters.logN !== parameters.logN ||
		parsed.parameters.r !== parameters.r ||
		parsed.parameters.p !== parameters.p
	);
}
