import type { BakedSurface } from "./bakeSurface";
import { bakeRecipe, FINE_RECIPES, fineSize } from "./recipes";

interface Job {
	id: number;
	key: string;
	detail: number;
	resolve: (baked: BakedSurface) => void;
	reject: (error: Error) => void;
}

interface Reply {
	id: number;
	baked?: BakedSurface;
	error?: string;
}

const IDLE_MS = 8000;

const cache = new Map<string, BakedSurface>();
const pending = new Map<string, Promise<BakedSurface>>();

function slot(key: string, detail: number): string {
	return `${key}@${detail}`;
}

class BakerPool {
	private readonly idle: Worker[] = [];
	private readonly busy = new Map<Worker, Job>();
	private readonly queue: Job[] = [];
	private nextId = 1;
	private retire: ReturnType<typeof setTimeout> | null = null;
	private size = 0;
	private broken = false;

	run(key: string, detail: number): Promise<BakedSurface> {
		return new Promise((resolve, reject) => {
			this.queue.push({ id: this.nextId++, key, detail, resolve, reject });
			this.pump();
		});
	}

	private capacity(): number {
		const cores =
			typeof navigator === "undefined" ? 2 : navigator.hardwareConcurrency || 2;
		return Math.max(1, Math.min(4, cores - 1));
	}

	private spawn(): Worker | null {
		if (this.broken || typeof Worker === "undefined") {
			return null;
		}
		try {
			const worker = new Worker(
				new URL("./surface.worker.ts", import.meta.url),
				{
					type: "module",
				},
			);
			worker.onmessage = (event: MessageEvent<Reply>) =>
				this.finish(worker, event.data);
			worker.onerror = () => this.fail(worker);
			this.size += 1;
			return worker;
		} catch {
			this.broken = true;
			return null;
		}
	}

	private pump(): void {
		if (this.retire) {
			clearTimeout(this.retire);
			this.retire = null;
		}
		while (this.queue.length > 0) {
			let worker = this.idle.pop() ?? null;
			if (!worker && this.size < this.capacity()) {
				worker = this.spawn();
			}
			if (!worker) {
				if (this.size === 0) {
					this.drainHere();
				}
				return;
			}
			const job = this.queue.shift() as Job;
			this.busy.set(worker, job);
			worker.postMessage({ id: job.id, key: job.key, detail: job.detail });
		}
		if (this.busy.size === 0) {
			this.retire = setTimeout(() => this.shutdown(), IDLE_MS);
		}
	}

	private drainHere(): void {
		const jobs = this.queue.splice(0);
		for (const job of jobs) {
			try {
				job.resolve(bakeRecipe(job.key, job.detail));
			} catch (error) {
				job.reject(error instanceof Error ? error : new Error(String(error)));
			}
		}
	}

	private finish(worker: Worker, reply: Reply): void {
		const job = this.busy.get(worker);
		this.busy.delete(worker);
		this.idle.push(worker);
		if (job) {
			if (reply.baked) {
				job.resolve(reply.baked);
			} else {
				job.reject(new Error(reply.error ?? job.key));
			}
		}
		this.pump();
	}

	private fail(worker: Worker): void {
		const job = this.busy.get(worker);
		this.busy.delete(worker);
		worker.terminate();
		this.size -= 1;
		this.broken = true;
		if (job) {
			this.queue.unshift(job);
		}
		this.pump();
	}

	private shutdown(): void {
		this.retire = null;
		if (this.busy.size > 0 || this.queue.length > 0) {
			return;
		}
		for (const worker of this.idle.splice(0)) {
			worker.terminate();
		}
		this.size = 0;
	}
}

const pool = new BakerPool();

export function cachedSurface(
	key: string,
	detail: number,
): BakedSurface | null {
	return cache.get(slot(key, detail)) ?? null;
}

export function requestSurface(
	key: string,
	detail: number,
): Promise<BakedSurface> {
	const id = slot(key, detail);
	const existing = cache.get(id);
	if (existing) {
		return Promise.resolve(existing);
	}
	const running = pending.get(id);
	if (running) {
		return running;
	}
	const promise = pool
		.run(key, detail)
		.then((baked) => {
			cache.set(id, baked);
			return baked;
		})
		.finally(() => pending.delete(id));
	pending.set(id, promise);
	return promise;
}

export async function prepareSurfaces(
	keys: readonly string[],
	detail: number,
	progress?: (fraction: number) => void,
): Promise<void> {
	const ordered = keys
		.filter((key) => key in FINE_RECIPES)
		.sort((a, b) => {
			const [aw, ah] = fineSize(FINE_RECIPES[a], detail);
			const [bw, bh] = fineSize(FINE_RECIPES[b], detail);
			return bw * bh - aw * ah;
		});
	let done = 0;
	await Promise.all(
		ordered.map((key) =>
			requestSurface(key, detail).then(() => {
				done += 1;
				progress?.(done / ordered.length);
			}),
		),
	);
}
