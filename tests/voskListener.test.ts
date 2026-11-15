import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mic = { level: 0 };

vi.mock("../src/features/voice/micManager", () => ({
	micManager: {
		inputStream: { id: "micro" },
		measure: () => mic.level,
	},
}));

const shared = {
	closed: 0,
	destination: {},
	createMediaStreamSource() {
		return { connect: (target: unknown) => target, disconnect() {} };
	},
	createGain() {
		return {
			gain: { value: 1 },
			connect: (target: unknown) => target,
			disconnect() {},
		};
	},
	resume() {
		return Promise.resolve();
	},
	close() {
		shared.closed += 1;
		return Promise.resolve();
	},
};

vi.mock("../src/features/audio/audioEngine", () => ({
	audioEngine: {
		get ctx() {
			return shared;
		},
	},
}));

vi.mock("../src/features/voice/voiceWorklet", () => ({
	loadVoiceWorklet: () => Promise.resolve(true),
}));

vi.mock("../src/i18n", () => ({
	currentLanguage: () => "fr",
	currentMessages: () => ({
		game: {
			speech: {
				loading: "chargement",
				failedToStart: "échec",
				generic: "erreur",
			},
		},
	}),
}));

type Reply =
	| {
			event: "partialresult";
			recognizerId: string;
			result: { partial: string };
	  }
	| { event: "result"; recognizerId: string; result: { text: string } };

const SAMPLE_RATE = 16_000;
const CHUNK = 4096;
const CHUNK_MS = (CHUNK / SAMPLE_RATE) * 1000;

class FakeProcessor {
	onaudioprocess: ((event: unknown) => void) | null = null;
	connect(target: unknown) {
		return target;
	}
	disconnect() {}
}

let processors: FakeProcessor[] = [];

class FakeWorkletNode {
	readonly port: { onmessage: ((event: { data: Int16Array }) => void) | null } =
		{ onmessage: null };
	constructor(
		readonly context: unknown,
		readonly name: string,
	) {
		worklets.push(this);
	}
	connect(target: unknown) {
		return target;
	}
	disconnect() {}
}

let worklets: FakeWorkletNode[] = [];

const FIREFOX =
	"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";
const CHROME =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

class FakeAudioContext {
	readonly sampleRate = SAMPLE_RATE;
	readonly destination = {};
	createMediaStreamSource() {
		return { connect: (target: unknown) => target, disconnect() {} };
	}
	createScriptProcessor() {
		const processor = new FakeProcessor();
		processors.push(processor);
		return processor;
	}
	createGain() {
		return {
			gain: { value: 1 },
			connect: (target: unknown) => target,
			disconnect() {},
		};
	}
	resume() {
		return Promise.resolve();
	}
	close() {
		return Promise.resolve();
	}
}

class FakeBackend {
	readonly ready = true;
	readonly failed = false;
	sessions: {
		id: string;
		listener: (reply: Reply) => void;
		fed: number[];
	}[] = [];
	script: (string | { result: string })[] = [];
	rates: number[] = [];
	private counter = 0;

	open(rate: number, listener: (reply: Reply) => void) {
		this.counter += 1;
		const id = `r${this.counter}`;
		this.rates.push(rate);
		this.sessions.push({ id, listener, fed: [] });
		return id;
	}

	feed(id: string, samples: Float32Array, rate: number) {
		const session = this.sessions.find((entry) => entry.id === id);
		if (!session) {
			return;
		}
		this.rates.push(rate);
		session.fed.push(samples[0] ?? 0);
		const next = this.script.shift() ?? "";
		if (typeof next === "string") {
			session.listener({
				event: "partialresult",
				recognizerId: id,
				result: { partial: next },
			});
		} else {
			session.listener({
				event: "result",
				recognizerId: id,
				result: { text: next.result },
			});
		}
	}

	conclude(id: string) {
		const session = this.sessions.find((entry) => entry.id === id);
		queueMicrotask(() =>
			session?.listener({
				event: "result",
				recognizerId: id,
				result: { text: "" },
			}),
		);
	}

	close() {}

	get current() {
		return this.sessions[this.sessions.length - 1];
	}
}

interface Listener {
	readonly active: boolean;
	start(
		callbacks: {
			onInterim: (text: string) => void;
			onFinal: (alternatives: string[]) => void;
			onError: (message: string) => void;
			onEnd: () => void;
		},
		formulas: readonly (readonly string[])[],
	): boolean;
	stop(): void;
}

const clientRoot = "../src/features/voice";
const { VoskListener, sessionTranscripts } = (await import(
	`${clientRoot}/voskRecognizer.ts`
)) as {
	VoskListener: new (backendFor: () => FakeBackend) => Listener;
	sessionTranscripts: (
		segments: readonly { final: string; partial: string }[],
		partial: string,
	) => string[];
};

let backend: FakeBackend;
let listener: Listener;
let finals: string[][];
let ended: number;

function callbacks() {
	return {
		onInterim: () => undefined,
		onFinal: (alternatives: string[]) => finals.push(alternatives),
		onError: () => undefined,
		onEnd: () => {
			ended += 1;
		},
	};
}

function chunk(marker: number) {
	const processor = processors[processors.length - 1];
	const data = new Float32Array(CHUNK).fill(marker / 0x8000);
	processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => data } });
	vi.advanceTimersByTime(CHUNK_MS);
}

async function settle() {
	for (let index = 0; index < 5; index += 1) {
		await Promise.resolve();
	}
}

async function talk(milliseconds: number, marker = 1) {
	for (let elapsed = 0; elapsed < milliseconds; elapsed += CHUNK_MS) {
		chunk(marker);
		await settle();
	}
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
	vi.stubGlobal("window", globalThis);
	vi.stubGlobal("AudioContext", FakeAudioContext);
	vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
	processors = [];
	worklets = [];
	shared.closed = 0;
	mic.level = 0;
	backend = new FakeBackend();
	listener = new VoskListener(() => backend);
	finals = [];
	ended = 0;
});

afterEach(() => {
	listener.stop();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("écoute des incantations", () => {
	it("ne coupe pas l'écoute au milieu d'une phrase", async () => {
		listener.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		mic.level = 0;
		await talk(6_200);
		mic.level = 0.6;
		await talk(1_600);
		expect(listener.active).toBe(true);
		expect(ended).toBe(0);
		mic.level = 0;
		await talk(1_000);
		await settle();
		expect(ended).toBe(1);
	});

	it("garde le son entendu entre deux écoutes et le transmet à la suivante", async () => {
		listener.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		let produced = 0;
		for (let index = 0; index < 30; index += 1) {
			chunk(1);
			produced += 1;
			await settle();
		}
		expect(ended).toBe(1);
		for (let index = 0; index < 4; index += 1) {
			chunk(7);
			produced += 1;
		}
		listener.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		const [first, second] = backend.sessions;
		expect(first.fed.length + second.fed.length).toBe(produced);
		expect(second.fed.slice(-4)).toEqual([7, 7, 7, 7]);
		expect(first.fed).not.toContain(7);
	});

	it("ne transmet pas un vieux son après un arrêt volontaire", () => {
		listener.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		listener.stop();
		listener.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		expect(backend.current.fed).toEqual([]);
	});

	it("garde la formule entendue en cours de route même si le résultat final la perd", async () => {
		listener.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		backend.script = [
			"ignis",
			"ignis umbra",
			"ignis umbra lumen",
			{ result: "" },
		];
		mic.level = 0.6;
		await talk(4 * CHUNK_MS);
		mic.level = 0;
		await talk(1_000);
		await settle();
		expect(finals).toHaveLength(1);
		expect(finals[0]).toContain("ignis umbra lumen");
	});

	it("borne une écoute interminable sous la limite du serveur", async () => {
		listener.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		mic.level = 0.6;
		await talk(9_500);
		await settle();
		expect(ended).toBe(1);
		const fedMs = backend.sessions[0].fed.length * CHUNK_MS;
		expect(fedMs).toBeLessThan(10_000);
	});
});

describe("transcriptions proposées", () => {
	it("propose le résultat final, puis les versions intermédiaires", () => {
		expect(
			sessionTranscripts(
				[
					{ final: "", partial: "ignis umbra lumen" },
					{ final: "stella", partial: "stella" },
				],
				"",
			),
		).toEqual(["stella", "ignis umbra lumen stella"]);
		expect(sessionTranscripts([], "ignis umbra")).toEqual(["ignis umbra"]);
		expect(sessionTranscripts([], "")).toEqual([]);
	});
});

describe("capture sur Firefox", () => {
	const BLOCK = 1600;
	const BLOCK_MS = (BLOCK / 16_000) * 1000;

	function block(amplitude: number, marker = 1) {
		const node = worklets[worklets.length - 1];
		const data = new Int16Array(BLOCK).fill(amplitude);
		data[0] = marker;
		node.port.onmessage?.({ data });
		vi.advanceTimersByTime(BLOCK_MS);
	}

	async function speak(milliseconds: number, amplitude: number) {
		for (let elapsed = 0; elapsed < milliseconds; elapsed += BLOCK_MS) {
			block(amplitude);
			await settle();
		}
	}

	async function firefoxListener(): Promise<Listener> {
		vi.stubGlobal("navigator", { userAgent: FIREFOX });
		const created = new VoskListener(() => backend);
		await settle();
		return created;
	}

	it("passe par le worklet du contexte audio du jeu, à 16 kHz", async () => {
		const firefox = await firefoxListener();
		firefox.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		expect(worklets).toHaveLength(1);
		expect(worklets[0].context).toBe(shared);
		expect(worklets[0].name).toBe("voice-capture");
		expect(processors).toHaveLength(0);
		block(0, 3);
		block(0, 4);
		expect(backend.current.fed).toEqual([3, 4]);
		expect(new Set(backend.rates)).toEqual(new Set([16_000]));
		firefox.stop();
		expect(shared.closed).toBe(0);
	});

	it("sent la voix au son capté, même si le vumètre reste muet", async () => {
		const firefox = await firefoxListener();
		firefox.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		mic.level = 0;
		await speak(6_200, 0);
		await speak(1_600, 6000);
		expect(firefox.active).toBe(true);
		expect(ended).toBe(0);
		await speak(1_000, 0);
		expect(ended).toBe(1);
		firefox.stop();
	});

	it("garde le son entre deux écoutes, sans en perdre", async () => {
		const firefox = await firefoxListener();
		firefox.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		await speak(7_500, 0);
		expect(ended).toBe(1);
		block(0, 9);
		block(0, 9);
		firefox.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		expect(backend.current.fed.slice(-2)).toEqual([9, 9]);
		firefox.stop();
	});
});

describe("capture sur Chrome", () => {
	it("garde son propre contexte audio et le ScriptProcessor", async () => {
		vi.stubGlobal("navigator", { userAgent: CHROME });
		const chrome = new VoskListener(() => backend);
		await settle();
		chrome.start(callbacks(), [["ignis", "umbra", "lumen"]]);
		expect(processors).toHaveLength(1);
		expect(worklets).toHaveLength(0);
		chunk(5);
		expect(backend.current.fed).toEqual([5]);
		expect(new Set(backend.rates)).toEqual(new Set([SAMPLE_RATE]));
		chrome.stop();
	});
});
