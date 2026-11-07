import { createStore } from "../utils/store";

export type Screen = "home" | "lobby" | "loading" | "game" | "results";

export type Overlay =
	| "settings"
	| "account"
	| "bestiary"
	| "friends"
	| "challenges"
	| "daily"
	| null;

export interface Toast {
	id: number;
	text: string;
	tone: "info" | "error" | "success";
}

export interface AppState {
	screen: Screen;
	overlay: Overlay;
	toasts: Toast[];
}

export const appStore = createStore<AppState>({
	screen: "home",
	overlay: null,
	toasts: [],
});

let toastCounter = 0;

export function navigate(screen: Screen): void {
	appStore.set({ screen });
}

export function openOverlay(overlay: Overlay): void {
	appStore.set({ overlay });
}

export function closeOverlay(): void {
	appStore.set({ overlay: null });
}

export function showToast(
	text: string,
	tone: Toast["tone"] = "info",
	durationMs = 4200,
): void {
	toastCounter += 1;
	const toast = { id: toastCounter, text, tone };
	appStore.set((state) => ({ toasts: [...state.toasts.slice(-3), toast] }));
	window.setTimeout(() => {
		appStore.set((state) => ({
			toasts: state.toasts.filter((entry) => entry.id !== toast.id),
		}));
	}, durationMs);
}
