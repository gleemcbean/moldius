import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"discord-bridge",
);
const build = join(root, "build");

if (
	!existsSync(join(root, "sdk", "discord_social_sdk", "include", "discordpp.h"))
) {
	console.error(
		"Discord Social SDK absent : décompressez le SDK C++ dans discord-bridge/sdk/ (voir le README).",
	);
	process.exit(1);
}

function run(args) {
	const result = spawnSync("cmake", args, { stdio: "inherit" });
	if (result.error) {
		console.error("CMake introuvable : installez-le puis relancez.");
		process.exit(1);
	}
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

run([
	"-S",
	root,
	"-B",
	build,
	...(process.platform === "win32"
		? ["-A", "x64"]
		: ["-DCMAKE_BUILD_TYPE=Release"]),
]);
run(["--build", build, "--config", "Release"]);
run([
	"--install",
	build,
	"--config",
	"Release",
	"--prefix",
	join(root, "dist"),
]);
console.log("Pont Discord prêt dans discord-bridge/dist");
