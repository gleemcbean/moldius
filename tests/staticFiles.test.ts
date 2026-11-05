import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { absoluteShareUrls } from "../server/app.js";
import { type RunningServer, startServer } from "../server/index.js";

const SOURCE_INDEX = readFileSync(
	new URL("../index.html", import.meta.url),
	"utf8",
);

let server: RunningServer;
let directory: string;
const previous = process.env.CLIENT_DIST_DIR;

beforeAll(async () => {
	directory = mkdtempSync(join(tmpdir(), "moldius-dist-"));
	mkdirSync(join(directory, "vosk"));
	writeFileSync(join(directory, "index.html"), SOURCE_INDEX);
	writeFileSync(
		join(directory, "vosk", "worker.js"),
		"self.onmessage = () => {};",
	);
	process.env.CLIENT_DIST_DIR = directory;
	process.env.HOST = "127.0.0.1";
	server = await startServer({ port: 0, dev: false, database: null });
});

afterAll(async () => {
	await server.close();
	rmSync(directory, { recursive: true, force: true });
	if (previous === undefined) {
		delete process.env.CLIENT_DIST_DIR;
	} else {
		process.env.CLIENT_DIST_DIR = previous;
	}
});

describe("fichiers du client", () => {
	it("le worker de reconnaissance vocale a sa propre politique, la page garde la sienne", async () => {
		const worker = await fetch(
			`http://127.0.0.1:${server.port}/vosk/worker.js`,
		);
		expect(worker.status).toBe(200);
		const workerPolicy = worker.headers.get("content-security-policy") ?? "";
		expect(workerPolicy).toContain("'unsafe-eval'");
		expect(workerPolicy).toContain("'wasm-unsafe-eval'");
		expect(workerPolicy).toContain("default-src 'none'");

		const page = await fetch(`http://127.0.0.1:${server.port}/`);
		const pagePolicy = page.headers.get("content-security-policy") ?? "";
		expect(pagePolicy).toContain("script-src 'self'");
		expect(pagePolicy).not.toContain("unsafe-eval");
		expect(pagePolicy).toContain("worker-src 'self' blob:");
	});

	it("un lien d'invitation /CODE renvoie l'application", async () => {
		const invite = await fetch(`http://127.0.0.1:${server.port}/AB3CD`);
		expect(invite.status).toBe(200);
		expect(await invite.text()).toContain("<title>Moldius</title>");
	});

	it("donne aux liens partagés un titre, une description et une image absolue", async () => {
		const page = await (await fetch(`http://127.0.0.1:${server.port}/`)).text();
		for (const tag of [
			'property="og:title" content="Moldius"',
			'name="twitter:card" content="summary_large_image"',
			'property="og:image:width" content="1200"',
		]) {
			expect(page).toContain(tag);
		}
		const description = /name="description" content="([^"]+)"/.exec(page)?.[1];
		expect(description?.length).toBeGreaterThan(60);
		expect(description?.length).toBeLessThan(220);
		const image = /property="og:image" content="([^"]+)"/.exec(page)?.[1];
		expect(image).toMatch(/^https?:\/\/[^/]+\/og-image\.jpg$/);
		expect(page).toMatch(
			/name="twitter:image" content="https?:\/\/[^/]+\/og-image\.jpg"/,
		);
		const file = statSync(new URL("../public/og-image.jpg", import.meta.url));
		expect(file.size).toBeGreaterThan(20_000);
		expect(file.size).toBeLessThan(1_000_000);
	});

	it("rend absolues les seules adresses des balises de partage", () => {
		const html =
			'<meta property="og:image" content="/og.jpg" /><meta property="og:url" content="/" /><link rel="icon" href="/favicon.svg" />';
		expect(absoluteShareUrls(html, "https://moldius.test/")).toBe(
			'<meta property="og:image" content="https://moldius.test/og.jpg" /><meta property="og:url" content="https://moldius.test/" /><link rel="icon" href="/favicon.svg" />',
		);
	});
});
