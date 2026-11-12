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
	document.documentElement.removeAttribute("data-booting");
	const boot = bootElement();
	if (!boot) {
		return;
	}
	boot.classList.add("boot-done");
	window.setTimeout(() => boot.remove(), FADE_MS);
}
