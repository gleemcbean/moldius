import type { ActionId } from "../types/settings";

export const DEFAULT_KEYS: Record<ActionId, string> = {
	moveForward: "KeyW",
	moveBackward: "KeyS",
	moveLeft: "KeyA",
	moveRight: "KeyD",
	sprint: "ShiftLeft",
	crouch: "ControlLeft",
	jump: "Space",
	grimoire: "KeyG",
	lantern: "KeyF",
	interact: "KeyE",
	push: "KeyR",
	shout: "KeyX",
	map: "KeyM",
	leaderboard: "Tab",
	pagePrevious: "ArrowLeft",
	pageNext: "ArrowRight",
};
