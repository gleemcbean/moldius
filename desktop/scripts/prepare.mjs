import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function publicUrlFromEnv() {
	const envFile = join(root, "..", ".env");
	if (!existsSync(envFile)) {
		return null;
	}

	const line = readFileSync(envFile, "utf8")
		.split(/\r?\n/)
		.find((entry) => entry.startsWith("PUBLIC_URL="));

	return line
		? line
				.slice("PUBLIC_URL=".length)
				.trim()
				.replace(/^["']|["']$/g, "")
		: null;
}

const raw =
	process.env.MOLDIUS_URL || publicUrlFromEnv() || "http://localhost:5173";
let url;

try {
	url = new URL(raw);
} catch {
	console.error("Adresse du jeu invalide (MOLDIUS_URL ou PUBLIC_URL).");
	process.exit(1);
}

if (
	url.protocol !== "https:" &&
	url.hostname !== "localhost" &&
	url.hostname !== "127.0.0.1"
) {
	console.error("L'adresse du jeu doit être en https (sauf en local).");
	process.exit(1);
}

writeFileSync(
	join(root, "app-config.json"),
	`${JSON.stringify({ url: url.origin }, null, "\t")}\n`,
);

console.log(
	url.hostname === "localhost" || url.hostname === "127.0.0.1"
		? "Jeu : serveur local"
		: "Jeu : serveur en ligne",
);
