/**
 * L'écran de chargement d'index.html reste affiché jusqu'à ce que l'application
 * soit montée, ses polices chargées, et que chaque attente déclarée (la première
 * image du décor 3D de l'accueil) soit levée. Un délai de secours le retire quoi qu'il arrive.
 */

const FONTS_TIMEOUT_MS = 3000;
const SAFETY_TIMEOUT_MS = 8000;
const FADE_MS = 520;

const holds = new Set<symbol>();
let mounted = false;
let pending = false;
let finished = false;

function bootElement(): HTMLElement | null {
	return document.getElementById("boot");
}

/** Retient l'écran de chargement ; la fonction rendue le libère (plusieurs appels sans effet). */
export function holdBoot(): () => void {
	const token = Symbol("boot");
	if (!finished) {
		holds.add(token);
	}
	return () => {
		if (holds.delete(token)) {
			scheduleFinish();
		}
	};
}

/** À appeler une fois l'application montée : les attentes de ses enfants sont déjà déclarées. */
export function appMounted(): void {
	if (mounted) {
		return;
	}
	mounted = true;
	window.setTimeout(finishBoot, SAFETY_TIMEOUT_MS);
	scheduleFinish();
}

function fontsReady(): Promise<unknown> {
	const fonts = document.fonts?.ready ?? Promise.resolve();
	return Promise.race([
		fonts,
		new Promise((resolve) => window.setTimeout(resolve, FONTS_TIMEOUT_MS)),
	]);
}

function scheduleFinish(): void {
	if (finished || pending || !mounted || holds.size > 0) {
		return;
	}
	pending = true;
	// Une image d'attente : une attente reprise aussitôt (StrictMode) garde l'écran.
	void fontsReady().then(() =>
		requestAnimationFrame(() => {
			pending = false;
			if (holds.size === 0) {
				finishBoot();
			}
		}),
	);
}

function finishBoot(): void {
	if (finished) {
		return;
	}
	finished = true;
	holds.clear();
	// Les animations d'entrée de la page, figées jusqu'ici, partent pendant le fondu.
	document.documentElement.removeAttribute("data-booting");
	const boot = bootElement();
	if (!boot) {
		return;
	}
	boot.classList.add("boot-done");
	window.setTimeout(() => boot.remove(), FADE_MS);
}
