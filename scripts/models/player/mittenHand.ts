import type * as THREE from "three";
import {
	MITT_CENTER,
	MITT_RADIUS,
	MittenHand,
	RELAXED_HAND,
} from "../../../src/features/models/MittenHand";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import type { BuildKit } from "../kit";

export function buildMittenHand(
	kit: BuildKit,
	name: string,
	skin: MaterialOptions,
	thumbSide: 1 | -1,
	size = 1,
): THREE.Group {
	const root = kit.pivot(name);

	const mitt = kit.named(
		`${name}_mitt`,
		kit.sphere(MITT_RADIUS, skin, [1, 1.2, 0.85], 14),
	);

	mitt.position.y = MITT_CENTER;

	root.add(mitt);

	const thumb = kit.named(
		`${name}_thumb`,
		kit.sphere(0.024, skin, [1, 1.35, 1], 10),
	);

	root.add(thumb);
	root.scale.setScalar(size);
	new MittenHand(root, mitt, thumb, thumbSide).setPose(RELAXED_HAND);

	return root;
}
