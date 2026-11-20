let arrived = true;
const listeners = new Set<() => void>();

export function beginApproach(): void {
	arrived = false;
}

export function markArrived(): void {
	arrived = true;
	for (const listener of [...listeners]) {
		listener();
	}
	listeners.clear();
}

export function waitForArrival(timeoutMs: number): Promise<void> {
	if (arrived) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		const finish = () => {
			window.clearTimeout(timer);
			listeners.delete(finish);
			resolve();
		};
		const timer = window.setTimeout(finish, timeoutMs);
		listeners.add(finish);
	});
}
