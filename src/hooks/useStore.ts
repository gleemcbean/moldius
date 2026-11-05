import { useCallback, useRef, useSyncExternalStore } from "react";
import type { Store } from "../utils/store";

export function useStore<T extends object, S>(
	store: Store<T>,
	selector: (state: T) => S,
	equal: (a: S, b: S) => boolean = Object.is,
): S {
	const cache = useRef<{ value: S } | null>(null);
	const getSnapshot = useCallback(() => {
		const next = selector(store.get());
		if (cache.current && equal(cache.current.value, next)) {
			return cache.current.value;
		}
		cache.current = { value: next };
		return next;
	}, [store, selector, equal]);
	return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function shallowEqual<T>(a: T, b: T): boolean {
	if (Object.is(a, b)) {
		return true;
	}
	if (
		typeof a !== "object" ||
		typeof b !== "object" ||
		a === null ||
		b === null
	) {
		return false;
	}
	const keysA = Object.keys(a) as (keyof T)[];
	const keysB = Object.keys(b) as (keyof T)[];
	return (
		keysA.length === keysB.length &&
		keysA.every((key) => Object.is(a[key], b[key]))
	);
}
