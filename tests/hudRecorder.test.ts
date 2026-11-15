import { describe, expect, it } from "vitest";

interface Gradient {
	addColorStop(offset: number, color: string): void;
}

interface Region {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

interface Recorder {
	begin(): void;
	section(): void;
	commit(): boolean;
	invalidate(): void;
	readonly repaintedAll: boolean;
	readonly repainted: readonly Region[];
	fillStyle: string | Gradient;
	font: string;
	globalAlpha: number;
	setTransform(
		a: number,
		b: number,
		c: number,
		d: number,
		e: number,
		f: number,
	): void;
	translate(x: number, y: number): void;
	fill(path?: unknown): void;
	measureText(text: string): { width: number };
	createRadialGradient(
		x0: number,
		y0: number,
		r0: number,
		x1: number,
		y1: number,
		r1: number,
	): Gradient;
	fillRect(x: number, y: number, width: number, height: number): void;
	fillText(text: string, x: number, y: number): void;
	save(): void;
	restore(): void;
}

const clientRoot = "../src";
const { HudRecorder } = (await import(
	`${clientRoot}/features/hud/HudRecorder.ts`
)) as {
	HudRecorder: new (target: unknown) => Recorder;
};

function fakeContext(canvas?: { width: number; height: number }) {
	const calls: string[] = [];
	let measures = 0;
	const target: Record<string, unknown> = {
		canvas,
		font: "10px sans-serif",
		measureText(text: string) {
			measures += 1;
			return { width: text.length * 7 };
		},
		createRadialGradient(...args: number[]) {
			calls.push(`gradient(${args.join(",")})`);
			return {
				addColorStop(offset: number, color: string) {
					calls.push(`stop(${offset},${color})`);
				},
				tag: "gradient",
			};
		},
	};
	for (const method of [
		"fillRect",
		"fillText",
		"save",
		"restore",
		"setTransform",
		"clearRect",
		"setLineDash",
		"beginPath",
		"rect",
		"clip",
		"fill",
		"translate",
	]) {
		target[method] = (...args: unknown[]) => {
			calls.push(`${method}(${args.join(",")})`);
		};
	}
	const context = new Proxy(target, {
		set(object, key, value) {
			const shown =
				typeof value === "object" && value !== null ? "[gradient]" : value;
			calls.push(`${String(key)}=${shown}`);
			object[key as string] = value;
			return true;
		},
	});
	return {
		context: context as unknown,
		calls,
		measures: () => measures,
	};
}

function paint(recorder: Recorder, x: number): void {
	recorder.begin();
	recorder.save();
	const gradient = recorder.createRadialGradient(0, 0, 0, 0, 0, 1);
	gradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");
	recorder.fillStyle = gradient;
	recorder.fillRect(0, 0, 10, 10);
	recorder.restore();
	recorder.font = "700 20px serif";
	recorder.fillStyle = "#fff";
	recorder.globalAlpha = 0.5;
	recorder.fillText("bonjour", x, 4);
}

describe("enregistreur du HUD", () => {
	it("rejoue les commandes dans l'ordre sur le vrai contexte", () => {
		const fake = fakeContext();
		const recorder = new HudRecorder(fake.context);
		paint(recorder, 12);
		expect(recorder.commit()).toBe(true);
		const drawn = fake.calls.filter(
			(call) =>
				call.startsWith("gradient") ||
				call.startsWith("stop") ||
				call.startsWith("fillRect") ||
				call.startsWith("fillText") ||
				call === "fillStyle=[gradient]",
		);
		expect(drawn).toEqual([
			"gradient(0,0,0,0,0,1)",
			"stop(0.5,rgba(0, 0, 0, 0))",
			"fillStyle=[gradient]",
			"fillRect(0,0,10,10)",
			"fillText(bonjour,12,4)",
		]);
		expect(fake.calls).toContain("globalAlpha=0.5");
		expect(fake.calls).toContain("font=700 20px serif");
	});

	it("ne repeint pas une image identique et repeint dès qu'elle change", () => {
		const fake = fakeContext();
		const recorder = new HudRecorder(fake.context);
		paint(recorder, 12);
		expect(recorder.commit()).toBe(true);
		const count = fake.calls.length;
		paint(recorder, 12);
		expect(recorder.commit()).toBe(false);
		expect(fake.calls.length).toBe(count);
		paint(recorder, 13);
		expect(recorder.commit()).toBe(true);
		expect(fake.calls).toContain("fillText(bonjour,13,4)");
		paint(recorder, 13);
		recorder.invalidate();
		expect(recorder.commit()).toBe(true);
	});

	it("mémorise les mesures de texte par police", () => {
		const fake = fakeContext();
		const recorder = new HudRecorder(fake.context);
		recorder.begin();
		recorder.font = "700 20px serif";
		expect(recorder.measureText("abc").width).toBe(21);
		expect(recorder.measureText("abc").width).toBe(21);
		recorder.font = "500 16px serif";
		recorder.measureText("abc");
		expect(fake.measures()).toBe(2);
	});

	it("ne repeint que la zone de la section modifiée", () => {
		const fake = fakeContext({ width: 1000, height: 800 });
		const recorder = new HudRecorder(fake.context);
		const frame = (x: number) => {
			recorder.begin();
			recorder.fillStyle = "red";
			recorder.fillRect(10, 10, 50, 20);
			recorder.section();
			recorder.fillStyle = "blue";
			recorder.fillRect(x, 600, 40, 40);
		};
		frame(500);
		expect(recorder.commit()).toBe(true);
		expect(recorder.repaintedAll).toBe(true);
		fake.calls.length = 0;
		frame(500);
		expect(recorder.commit()).toBe(false);
		expect(fake.calls).toEqual([]);
		frame(520);
		expect(recorder.commit()).toBe(true);
		expect(recorder.repaintedAll).toBe(false);
		expect(recorder.repainted).toHaveLength(1);
		const [region] = recorder.repainted;
		expect(region.left).toBeLessThanOrEqual(500);
		expect(region.right).toBeGreaterThanOrEqual(560);
		expect(region.top).toBeLessThanOrEqual(600);
		expect(region.bottom).toBeGreaterThanOrEqual(640);
		expect(region.bottom - region.top).toBeLessThan(60);
		expect(fake.calls).not.toContain("fillRect(10,10,50,20)");
		expect(fake.calls).toContain("fillRect(520,600,40,40)");
		expect(fake.calls).toContain("clip()");
	});

	it("restaure l'état hérité quand une section précédente est sautée", () => {
		const fake = fakeContext({ width: 1000, height: 800 });
		const recorder = new HudRecorder(fake.context);
		const frame = (y: number) => {
			recorder.begin();
			recorder.setTransform(2, 0, 0, 2, 0, 0);
			recorder.fillStyle = "red";
			recorder.fillRect(0, 0, 10, 10);
			recorder.section();
			recorder.fillRect(200, y, 10, 10);
		};
		frame(300);
		recorder.commit();
		fake.calls.length = 0;
		frame(310);
		expect(recorder.commit()).toBe(true);
		expect(recorder.repaintedAll).toBe(false);
		const draw = fake.calls.indexOf("fillRect(200,310,10,10)");
		expect(draw).toBeGreaterThan(-1);
		const before = fake.calls.slice(0, draw);
		expect(before.lastIndexOf("fillStyle=red")).toBeGreaterThan(
			before.lastIndexOf("fillStyle=#000000"),
		);
		expect(before).toContain("setTransform(2,0,0,2,0,0)");
		const [region] = recorder.repainted;
		expect(region.left).toBeLessThanOrEqual(400);
		expect(region.top).toBeLessThanOrEqual(600);
		expect(region.bottom).toBeGreaterThanOrEqual(640);
	});

	it("tient compte des translations pour situer la zone", () => {
		const fake = fakeContext({ width: 1000, height: 800 });
		const recorder = new HudRecorder(fake.context);
		const frame = (size: number) => {
			recorder.begin();
			recorder.save();
			recorder.translate(700, 100);
			recorder.fillRect(0, 0, size, size);
			recorder.restore();
		};
		frame(10);
		recorder.commit();
		frame(12);
		expect(recorder.commit()).toBe(true);
		const [region] = recorder.repainted;
		expect(region.left).toBeLessThanOrEqual(700);
		expect(region.left).toBeGreaterThan(680);
		expect(region.top).toBeLessThanOrEqual(100);
		expect(region.top).toBeGreaterThan(80);
	});

	it("repeint tout quand la zone modifiée est trop grande ou inconnue", () => {
		const fake = fakeContext({ width: 1000, height: 800 });
		const recorder = new HudRecorder(fake.context);
		const shape = {};
		const frame = (alpha: number, path: boolean) => {
			recorder.begin();
			recorder.globalAlpha = alpha;
			recorder.fillRect(0, 0, 1000, 800);
			recorder.section();
			if (path) {
				recorder.fill(shape);
			}
		};
		frame(0.5, false);
		recorder.commit();
		frame(0.6, false);
		expect(recorder.commit()).toBe(true);
		expect(recorder.repaintedAll).toBe(true);
		frame(0.6, true);
		expect(recorder.commit()).toBe(true);
		expect(recorder.repaintedAll).toBe(true);
		recorder.begin();
		recorder.section();
		recorder.section();
		expect(recorder.commit()).toBe(true);
		expect(recorder.repaintedAll).toBe(true);
	});
});
