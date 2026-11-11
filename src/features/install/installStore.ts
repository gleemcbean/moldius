import { desktopApp } from "../../app/desktopApp";
import { createStore } from "../../utils/store";

export const DESKTOP_DOWNLOAD_URL = "/download/Moldius-Setup.exe";

export const installStore = createStore({ available: false });

function onWindows(): boolean {
	return /Windows/i.test(navigator.userAgent);
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

	if (desktopApp || !onWindows()) {
		return;
	}

	void fetch(DESKTOP_DOWNLOAD_URL, { method: "HEAD", cache: "no-store" })
		.then((response) => {
			if (response.ok) {
				installStore.set({ available: true });
			}
		})
		.catch(() => undefined);
}

export function promptInstall(): void {
	window.location.href = DESKTOP_DOWNLOAD_URL;
}
