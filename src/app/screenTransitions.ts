import { flushSync } from "react-dom";
import { settingsStore } from "../features/settings/settingsStore";
import type { Overlay, Screen } from "./appStore";

export type TransitionKind = "forward" | "back" | "dive" | "rise" | "close";

export interface AppView {
	screen: Screen;
	overlay: Overlay;
}

const SCREEN_ORDER: Record<Screen, number> = {
	home: 0,
	lobby: 1,
	loading: 2,
	game: 3,
	results: 4,
};

export function transitionKind(
	from: AppView,
	to: AppView,
): TransitionKind | null {
	if (from.screen !== to.screen) {
		if (to.screen === "game") {
			return "dive";
		}
		if (from.screen === "game" && to.screen === "results") {
			return "rise";
		}
		return SCREEN_ORDER[to.screen] > SCREEN_ORDER[from.screen]
			? "forward"
			: "back";
	}
	if (from.overlay !== null && to.overlay === null) {
		return "close";
	}
	return null;
}

export function motionReduced(): boolean {
	return (
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true ||
		settingsStore.get().reduceMotion
	);
}

let current = 0;

export function runTransition(
	kind: TransitionKind | null,
	update: () => void,
): void {
	if (
		kind === null ||
		!("startViewTransition" in document) ||
		document.visibilityState !== "visible" ||
		motionReduced()
	) {
		update();
		return;
	}
	const root = document.documentElement;
	current += 1;
	const token = current;
	root.dataset.transition = kind;
	const transition = document.startViewTransition(() => flushSync(update));
	void transition.finished.finally(() => {
		if (token === current) {
			delete root.dataset.transition;
		}
	});
}
