import { createHash, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createSessionToken(): string {
	return randomBytes(32).toString("base64url");
}

export function isSessionToken(value: string): boolean {
	return TOKEN_PATTERN.test(value);
}

export function hashSessionToken(token: string): string {
	return createHash("sha256").update(token, "utf8").digest("hex");
}
