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
import { InstallerType, latestInstaller } from "../server/app.js";
import {
	safeOrigin,
	steamDeckLauncher,
	steamDeckScript,
} from "../server/steamDeck.js";
import { detectDownloadPlatform } from "../src/features/install/platform.js";

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

		expect(
			latestInstaller(join(directory, "absent"), InstallerType.WIN),
		).toBeNull();

		mkdirSync(directory, { recursive: true });
		expect(latestInstaller(directory, InstallerType.WIN)).toBeNull();

		const older = join(directory, "Moldius-Setup-1.0.0.exe");
		const newer = join(directory, "Moldius-Setup-1.1.0.exe");

		writeFileSync(older, "a");
		writeFileSync(newer, "b");
		writeFileSync(join(directory, "Moldius-Setup-1.1.0.exe.blockmap"), "c");
		utimesSync(older, new Date(2026, 0, 2), new Date(2026, 0, 2));
		utimesSync(newer, new Date(2026, 0, 1), new Date(2026, 0, 1));
		expect(latestInstaller(directory, InstallerType.WIN)).toBe(older);
	});
});

describe("téléchargement adapté à la plateforme", () => {
	it("trouve les builds Linux nommés sans « Setup »", () => {
		const directory = mkdtempSync(join(tmpdir(), "moldius-release-"));
		const appImage = join(directory, "Moldius-1.2.2.AppImage");
		const deb = join(directory, "Moldius-Setup-1.2.2.deb");

		writeFileSync(appImage, "a");
		writeFileSync(deb, "b");
		writeFileSync(join(directory, "Moldius-1.2.2.AppImage.blockmap"), "c");
		expect(latestInstaller(directory, InstallerType.APPIMAGE)).toBe(appImage);
		expect(latestInstaller(directory, InstallerType.DEB)).toBe(deb);
		expect(latestInstaller(directory, InstallerType.RPM)).toBeNull();
	});

	it("choisit le format selon le système", () => {
		const cases: [string, string | null][] = [
			["Win32 Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "win"],
			["Linux x86_64 Mozilla/5.0 (X11; Linux x86_64)", "linux"],
			["Linux x86_64 Mozilla/5.0 (X11; Ubuntu; Linux x86_64)", "debian"],
			["Linux x86_64 Mozilla/5.0 (X11; Fedora; Linux x86_64)", "redhat"],
			["Linux armv8l Mozilla/5.0 (Linux; Android 14; Pixel 8)", null],
			["MacIntel Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", null],
			["iPhone Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", null],
		];

		for (const [hint, expected] of cases) {
			expect(detectDownloadPlatform(hint, false)).toBe(expected);
		}

		expect(
			detectDownloadPlatform(
				"Linux x86_64 Mozilla/5.0 (X11; Linux x86_64)",
				true,
			),
		).toBe("steamdeck");

		expect(
			detectDownloadPlatform(
				"Linux x86_64 Mozilla/5.0 (X11; Linux x86_64) Valve Steam GameOverlay",
				false,
			),
		).toBe("steamdeck");

		expect(
			detectDownloadPlatform(
				"Win32 Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
				true,
			),
		).toBe("win");
	});
});

describe("installation sur Steam Deck", () => {
	it("refuse les origines qui casseraient le script", () => {
		expect(safeOrigin("https://moldius.fr/chemin")).toBe("https://moldius.fr");

		expect(safeOrigin("http://192.168.1.4:3000")).toBe(
			"http://192.168.1.4:3000",
		);

		expect(safeOrigin('https://a"b.fr')).toBeNull();
		expect(safeOrigin("pas une url")).toBeNull();
		expect(safeOrigin("http://[::1]:5173")).toBe("http://[::1]:5173");
	});

	it("prépare un lanceur qui installe l'AppImage et l'ajoute à Steam", () => {
		const launcher = steamDeckLauncher("https://moldius.fr");
		const script = steamDeckScript("https://moldius.fr");

		expect(launcher).toContain("https://moldius.fr/download/steamdeck.sh");
		expect(launcher).toContain("Terminal=true");
		expect(script).toContain('ORIGIN="https://moldius.fr"');
		expect(script).toContain("chmod +x");
		expect(script).toContain("steamos-add-to-steam");
		expect(script).toContain("LANG:-");
		expect(script).toContain('CURL[@]}" -L');
		expect(script).not.toContain(" -k");

		expect(steamDeckScript("https://192.168.1.4:5173", true)).toContain(
			"curl -f -k",
		);

		expect(steamDeckLauncher("https://192.168.1.4:5173", true)).toContain(
			"curl -fsSLk",
		);
	});
});
