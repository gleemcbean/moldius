import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { latestInstaller } from "../server/app.js";

const PUBLIC = new URL("../public/", import.meta.url);

describe("application de bureau à la place de l'application web", () => {
	it("ne déclare plus d'application web installable", () => {
		const html = readFileSync(
			new URL("../index.html", import.meta.url),
			"utf8",
		);
		expect(html).not.toContain('rel="manifest"');
	});

	it("garde un service worker qui se retire de lui-même", () => {
		const worker = readFileSync(new URL("sw.js", PUBLIC), "utf8");
		expect(worker).toContain("registration.unregister()");
		expect(worker).not.toContain('addEventListener("fetch"');
	});

	it("sert le plus récent des installateurs Windows", () => {
		const directory = mkdtempSync(join(tmpdir(), "moldius-release-"));
		expect(latestInstaller(join(directory, "absent"))).toBeNull();
		mkdirSync(directory, { recursive: true });
		expect(latestInstaller(directory)).toBeNull();
		const older = join(directory, "MOLDIUS-Setup-1.0.0.exe");
		const newer = join(directory, "MOLDIUS-Setup-1.1.0.exe");
		writeFileSync(older, "a");
		writeFileSync(newer, "b");
		writeFileSync(join(directory, "MOLDIUS-Setup-1.1.0.exe.blockmap"), "c");
		utimesSync(older, new Date(2026, 0, 2), new Date(2026, 0, 2));
		utimesSync(newer, new Date(2026, 0, 1), new Date(2026, 0, 1));
		expect(latestInstaller(directory)).toBe(older);
	});
});
