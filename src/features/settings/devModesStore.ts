import {
	type DevModeId,
	type DevModes,
	noDevModes,
	sanitizeDevModes,
} from "@shared/devModes";
import { readJson, writeJson } from "../../utils/storage";
import { createStore } from "../../utils/store";

const STORAGE_KEY = "mycelium.devModes.v1";

export const devModesStore = createStore<DevModes>(
	sanitizeDevModes(readJson(STORAGE_KEY)),
);

devModesStore.subscribe((modes) => writeJson(STORAGE_KEY, modes));

export function setDevMode(id: DevModeId, enabled: boolean): void {
	devModesStore.set({ [id]: enabled });
}

export function activeDevModes(dev: boolean): DevModes {
	return dev ? devModesStore.get() : noDevModes();
}
