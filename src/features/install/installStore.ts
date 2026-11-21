import { desktopApp } from "../../app/desktopApp";
import { createStore } from "../../utils/store";
import {
	type DownloadPlatform,
	detectDownloadPlatform,
	downloadUrl,
} from "./platform";

export const installStore = createStore<{
	available: boolean;
	platform: DownloadPlatform | null;
}>({ available: false, platform: null });

const platform = detectDownloadPlatform();

let chosen: DownloadPlatform | null = null;

async function firstAvailable(
	candidates: DownloadPlatform[],
): Promise<DownloadPlatform | null> {
	for (const candidate of candidates) {
		try {
			const response = await fetch(downloadUrl(candidate), {
				method: "HEAD",
				cache: "no-store",
			});

			if (response.ok) {
				return candidate;
			}
		} catch {}
	}

	return null;
}

export function initInstall(): void {
	if ("serviceWorker" in navigator) {
		void navigator.serviceWorker
			.getRegistrations()
			.then((registrations) => {
				for (const registration of registrations) {
					void registration.unregister();
				}
			})
			.catch(() => undefined);
	}

	if (desktopApp || !platform) {
		return;
	}

	const candidates: DownloadPlatform[] =
		platform === "win" || platform === "linux"
			? [platform]
			: [platform, "linux"];

	void firstAvailable(candidates).then((available) => {
		chosen = available;

		if (available) {
			installStore.set({ available: true, platform: available });
		}
	});
}

export function promptInstall(): void {
	if (chosen) {
		window.location.href = downloadUrl(chosen);
	}
}

export function steamDeckCommand(origin: string, insecure: boolean): string {
	return `curl -fsSL${insecure ? "k" : ""} ${origin}/download/steamdeck.sh | bash`;
}
