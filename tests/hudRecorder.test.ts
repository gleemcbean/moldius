import { describe, expect, it } from "vitest";

interface Gradient {
	addColorStop(offset: number, color: string): void;
}

interface Recorder {
	begin(): void;
	commit(): boolean;
	invalidate(): void;
	fillStyle: string | Gradient;
	font: string;
	globalAlpha: number;
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

function fakeContext() {
	const calls: string[] = [];
	let measures = 0;
	const target: Record<string, unknown> = {
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
});
