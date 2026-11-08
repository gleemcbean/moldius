// L'application web installable est remplacée par l'application de bureau.
// Ce service worker ne sert plus qu'à se retirer chez ceux qui l'avaient installé.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
			.then(() => self.registration.unregister()),
	);
});
