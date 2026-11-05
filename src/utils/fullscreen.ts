interface KeyboardLockApi {
	lock(codes?: string[]): Promise<void>;
	unlock(): void;
}

const SHORTCUT_CODES = [
	"KeyW",
	"KeyQ",
	"KeyT",
	"KeyN",
	"KeyR",
	"KeyF",
	"KeyG",
	"Tab",
];

function keyboardLockApi(): KeyboardLockApi | null {
	const candidate = (
		navigator as Navigator & { keyboard?: Partial<KeyboardLockApi> }
	).keyboard;
	if (
		candidate &&
		typeof candidate.lock === "function" &&
		typeof candidate.unlock === "function"
	) {
		return candidate as KeyboardLockApi;
	}
	return null;
}

export function fullscreenSupported(): boolean {
	return typeof document.documentElement.requestFullscreen === "function";
}

export function keyboardLockSupported(): boolean {
	return keyboardLockApi() !== null;
}

export function isFullscreen(): boolean {
	return document.fullscreenElement !== null;
}

export async function enterGameFullscreen(
	boundCodes: readonly string[],
): Promise<boolean> {
	try {
		if (!isFullscreen()) {
			await document.documentElement.requestFullscreen({
				navigationUI: "hide",
			});
		}
		const codes = [...new Set([...boundCodes, ...SHORTCUT_CODES])].filter(
			(code) => code !== "Escape" && !code.startsWith("Mouse"),
		);
		await keyboardLockApi()?.lock(codes);
		return true;
	} catch {
		return false;
	}
}

export function releaseKeyboardLock(): void {
	keyboardLockApi()?.unlock();
}

export async function exitGameFullscreen(): Promise<void> {
	releaseKeyboardLock();
	if (isFullscreen()) {
		await document.exitFullscreen().catch(() => undefined);
	}
}
