import { performance } from "node:perf_hooks";

const origin = performance.now();

export function serverNow(): number {
	return Math.round((performance.now() - origin) * 10) / 10;
}
