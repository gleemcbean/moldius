export type Listener<T> = (state: T, previous: T) => void;

export interface Store<T> {
	get(): T;
	set(update: Partial<T> | ((state: T) => Partial<T>)): void;
	replace(state: T): void;
	subscribe(listener: Listener<T>): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
	let state = initial;
	const listeners = new Set<Listener<T>>();
	const notify = (previous: T) => {
		for (const listener of listeners) {
			listener(state, previous);
		}
	};
	return {
		get: () => state,
		set(update) {
			const patch = typeof update === "function" ? update(state) : update;
			const previous = state;
			state = { ...state, ...patch };
			notify(previous);
		},
		replace(next) {
			const previous = state;
			state = next;
			notify(previous);
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
