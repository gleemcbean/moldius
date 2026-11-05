export interface RandomSource {
	next(): number;
}

export class SeededRandom implements RandomSource {
	private state: number;

	constructor(seed: number) {
		this.state = seed >>> 0 || 0x9e3779b9;
	}

	static fromString(text: string): SeededRandom {
		return new SeededRandom(hashString(text));
	}

	next(): number {
		this.state = (this.state + 0x6d2b79f5) >>> 0;
		let t = this.state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	range(min: number, max: number): number {
		return min + (max - min) * this.next();
	}

	int(min: number, maxInclusive: number): number {
		return Math.floor(this.range(min, maxInclusive + 1));
	}

	chance(probability: number): boolean {
		return this.next() < probability;
	}

	pick<T>(items: readonly T[]): T {
		if (items.length === 0) {
			throw new Error("Cannot pick from an empty list");
		}
		return items[Math.floor(this.next() * items.length)] as T;
	}

	weighted<T>(entries: readonly (readonly [T, number])[]): T {
		const total = entries.reduce(
			(sum, [, weight]) => sum + Math.max(0, weight),
			0,
		);
		if (total <= 0) {
			return this.pick(entries)[0];
		}
		let roll = this.next() * total;
		for (const [value, weight] of entries) {
			roll -= Math.max(0, weight);
			if (roll <= 0) {
				return value;
			}
		}
		return entries[entries.length - 1][0];
	}

	shuffle<T>(items: readonly T[]): T[] {
		const copy = [...items];
		for (let index = copy.length - 1; index > 0; index -= 1) {
			const swap = Math.floor(this.next() * (index + 1));
			[copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T];
		}
		return copy;
	}

	fork(label: string | number): SeededRandom {
		return new SeededRandom(hashString(`${this.state}:${label}`));
	}

	snap(min: number, max: number, step: number): number {
		const steps = Math.floor((max - min) / step);
		return min + this.int(0, steps) * step;
	}
}

export function hashString(text: string): number {
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

export function hashNumbers(...values: number[]): number {
	let hash = 2166136261;
	for (const value of values) {
		hash ^= Math.floor(value * 1000) | 0;
		hash = Math.imul(hash, 16777619);
		hash ^= hash >>> 13;
	}
	return hash >>> 0;
}
