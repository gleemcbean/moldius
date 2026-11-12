import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fromEnvFile(name) {
	const envFile = join(root, "..", ".env");
	if (!existsSync(envFile)) {
		return null;
	}

	const line = readFileSync(envFile, "utf8")
		.split(/\r?\n/)
		.find((entry) => entry.startsWith(`${name}=`));

	return line
		? line
				.slice(name.length + 1)
				.trim()
				.replace(/^["']|["']$/g, "")
		: null;
}

const raw =
	process.env.MOLDIUS_URL ||
	fromEnvFile("PUBLIC_URL") ||
	"http://localhost:5173";
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

const discordApplicationId =
	process.env.MOLDIUS_DISCORD_APP_ID || fromEnvFile("DISCORD_CLIENT_ID") || "";
if (discordApplicationId && !/^[0-9]{5,25}$/.test(discordApplicationId)) {
	console.error("Identifiant d'application Discord invalide.");
	process.exit(1);
}

writeFileSync(
	join(root, "app-config.json"),
	`${JSON.stringify({ url: url.origin, discordApplicationId }, null, "\t")}\n`,
);

const bridge = join(root, "discord-bridge", "dist");
mkdirSync(bridge, { recursive: true });
const bridgeBuilt = ["moldius-discord.exe", "moldius-discord"].some((name) =>
	existsSync(join(bridge, name)),
);
if (discordApplicationId && !bridgeBuilt) {
	console.warn(
		"Pont Discord absent (discord-bridge/dist) : amis et présence Discord désactivés. Voir npm run bridge:build.",
	);
}

console.log(
	url.hostname === "localhost" || url.hostname === "127.0.0.1"
		? "Jeu : serveur local"
		: "Jeu : serveur en ligne",
);
