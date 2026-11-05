import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PUBLIC = new URL("../public/", import.meta.url);

interface ManifestIcon {
	src: string;
	sizes: string;
	type: string;
	purpose: string;
}

const manifest = JSON.parse(
	readFileSync(new URL("manifest.webmanifest", PUBLIC), "utf8"),
) as {
	name: string;
	start_url: string;
	display: string;
	icons: ManifestIcon[];
};

function pngSize(path: URL): string {
	const bytes = readFileSync(path);
	expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
	return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("application installable", () => {
	it("décrit une application autonome lancée à la racine", () => {
		expect(manifest.name).toBe("MOLDIUS");
		expect(manifest.start_url).toBe("/");
		expect(manifest.display).toBe("standalone");
		const html = readFileSync(
			new URL("../index.html", import.meta.url),
			"utf8",
		);
		expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
	});

	it("fournit des icônes PNG 192 et 512 px aux dimensions annoncées", () => {
		const sizes = manifest.icons.map((icon) => icon.sizes);
		expect(sizes).toContain("192x192");
		expect(sizes).toContain("512x512");
		expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(
			true,
		);
		for (const icon of manifest.icons) {
			expect(icon.type).toBe("image/png");
			expect(pngSize(new URL(`.${icon.src}`, PUBLIC))).toBe(icon.sizes);
		}
	});

	it("met en cache la page hors ligne référencée par le service worker", () => {
		const worker = readFileSync(new URL("sw.js", PUBLIC), "utf8");
		const offline = /OFFLINE_URL = "\/([^"]+)"/.exec(worker)?.[1];
		expect(offline).toBeDefined();
		expect(existsSync(new URL(offline as string, PUBLIC))).toBe(true);
	});
});
