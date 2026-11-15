export const TUTORIAL_STAGES = [
	"free",
	"stealth",
	"wound",
	"push",
	"shout",
	"capture",
	"pact",
	"sanctuary",
	"reliquary",
	"walkie",
	"camera",
] as const;

export type TutorialStage = (typeof TUTORIAL_STAGES)[number];

export function isTutorialStage(value: unknown): value is TutorialStage {
	return (
		typeof value === "string" &&
		(TUTORIAL_STAGES as readonly string[]).includes(value)
	);
}

export const TUTORIAL_DUMMY_ID = "tutorial-dummy";
export const TUTORIAL_DUMMY_COLOR = 0xc8b28a;
export const TUTORIAL_DUMMY_CAST_MS = 7_000;
export const TUTORIAL_DUMMY_REST_MS = 1_600;
export const TUTORIAL_WOUNDED_HEALTH = 50;
export const TUTORIAL_HEARD_INTERVAL_MS = 250;
export const TUTORIAL_STEALTH_NEAR = 3;
