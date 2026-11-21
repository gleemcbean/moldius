import type { Level } from "@shared/manor/types";
import { createStore } from "../../utils/store";

export interface MapState {
	zoom: number;
	panX: number;
	panZ: number;
	level: Level;
}

export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 6;

export const mapStore = createStore<MapState>({
	zoom: 1,
	panX: 0,
	panZ: 0,
	level: 0,
});

export function scaleMap(factor: number): void {
	const current = mapStore.get().zoom;
	const zoom = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, current * factor));

	if (zoom !== current) {
		mapStore.set({ zoom });
	}
}

export function zoomMap(delta: number): void {
	scaleMap(delta > 0 ? 1.25 : 0.8);
}

export function panMap(dx: number, dz: number): void {
	const state = mapStore.get();

	mapStore.set({ panX: state.panX + dx, panZ: state.panZ + dz });
}

export function resetMap(level?: Level): void {
	mapStore.set({
		zoom: 1,
		panX: 0,
		panZ: 0,
		...(level !== undefined ? { level } : {}),
	});
}
