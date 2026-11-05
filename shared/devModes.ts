export const DEV_MODE_IDS = [
	"fly",
	"immortal",
	"passThrough",
	"infiniteEnergy",
] as const;

export type DevModeId = (typeof DEV_MODE_IDS)[number];

export type DevModes = Record<DevModeId, boolean>;

export function noDevModes(): DevModes {
	return {
		fly: false,
		immortal: false,
		passThrough: false,
		infiniteEnergy: false,
	};
}

export function sanitizeDevModes(input: unknown): DevModes {
	const modes = noDevModes();
	if (typeof input !== "object" || input === null) {
		return modes;
	}
	for (const id of DEV_MODE_IDS) {
		modes[id] = (input as Record<string, unknown>)[id] === true;
	}
	return modes;
}

export function movesFreely(modes: DevModes): boolean {
	return modes.fly || modes.passThrough;
}
