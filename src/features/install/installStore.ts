import { desktopApp } from "../../app/desktopApp";
import { createStore } from "../../utils/store";
import { detectDownloadPlatform, downloadUrl } from "./platform";

export const installStore = createStore({ available: false });

const platform = detectDownloadPlatform();

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

	void fetch(downloadUrl(platform), { method: "HEAD", cache: "no-store" })
		.then((response) => {
			if (response.ok) {
				installStore.set({ available: true });
			}
		})
		.catch(() => undefined);
}

export function promptInstall(): void {
	if (platform) {
		window.location.href = downloadUrl(platform);
	}
}
