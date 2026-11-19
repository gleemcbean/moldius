import type { MaterialId, OccultId } from "@shared/config/occult";
import type * as THREE from "three";
import type { ModelKit } from "./modelKit";

export function createMaterialModel(
	kit: ModelKit,
	id: MaterialId,
): THREE.Group {
	return kit.model(`pickups/${id}`);
}

export function createOccultModel(kit: ModelKit, id: OccultId): THREE.Group {
	return kit.model(`occult/${id}`);
}
