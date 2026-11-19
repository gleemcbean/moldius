import type * as THREE from "three";
import type { ModelKit } from "./modelKit";

export function createWalkieModel(kit: ModelKit): THREE.Group {
	return kit.model("tools/walkie");
}
