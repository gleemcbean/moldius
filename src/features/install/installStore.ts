import { desktopApp } from "../../app/desktopApp";
import { createStore } from "../../utils/store";

/**
 * L'application de bureau (desktop/) remplace l'ancienne application web installable :
 * le bouton d'installation télécharge l'installateur Windows, quand le serveur en a un.
 */
export const DESKTOP_DOWNLOAD_URL = "/download/MOLDIUS-Setup.exe";

export const installStore = createStore({ available: false });

function onWindows(): boolean {
	return /Windows/i.test(navigator.userAgent);
}

export function initInstall(): void {
	// L'ancien service worker de l'application web est retiré chez ceux qui l'avaient.
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
	// Déjà dans l'application, ou pas sous Windows : rien à proposer.
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
