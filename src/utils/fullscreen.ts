interface KeyboardLockApi {
	lock(codes?: string[]): Promise<void>;
	unlock(): void;
}

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

export function keyboardLockSupported(): boolean {
	return keyboardLockApi() !== null;
}

export function isFullscreen(): boolean {
	return document.fullscreenElement !== null;
}

export function releaseKeyboardLock(): void {
	keyboardLockApi()?.unlock();
}
