import { openOverlay } from "../../app/appStore";

export type SettingsTab = "controls" | "display" | "stats" | "audio" | "dev";

let requested: SettingsTab | null = null;

export function openSettings(tab: SettingsTab): void {
	requested = tab;

	openOverlay("settings");
}

export function takeRequestedTab(): SettingsTab | null {
	const tab = requested;

	requested = null;

	return tab;
}
