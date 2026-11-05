import { createStore } from "../../utils/store";

interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const installStore = createStore({ available: false });

let deferredPrompt: InstallPromptEvent | null = null;

export function initInstall(): void {
	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferredPrompt = event as InstallPromptEvent;
		installStore.set({ available: true });
	});
	window.addEventListener("appinstalled", () => {
		deferredPrompt = null;
		installStore.set({ available: false });
	});
	if ("serviceWorker" in navigator) {
		window.addEventListener("load", () => {
			void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
		});
	}
}

export async function promptInstall(): Promise<void> {
	const prompt = deferredPrompt;
	if (!prompt) {
		return;
	}
	deferredPrompt = null;
	installStore.set({ available: false });
	await prompt.prompt();
	await prompt.userChoice;
}
