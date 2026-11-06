import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { orientLatheProfile } from "../shared/latheProfile.js";

/** Volume signé : positif quand les faces regardent vers l'extérieur. */
function signedVolume(geometry: THREE.BufferGeometry): number {
	const position = geometry.getAttribute("position");
	const index = geometry.getIndex() as THREE.BufferAttribute;
	const point = (at: number) =>
		new THREE.Vector3().fromBufferAttribute(position, index.getX(at));
	let volume = 0;
	for (let at = 0; at < index.count; at += 3) {
		volume += point(at).dot(point(at + 1).cross(point(at + 2))) / 6;
	}
	return volume;
}

const meterLathe = (values: [number, number][]) =>
	new THREE.LatheGeometry(
		orientLatheProfile(
			values.map(([radius, height]) => new THREE.Vector2(radius, height)),
		),
		12,
	);

describe("pièces tournées", () => {
	const chessFoot: [number, number][] = [
		[0.22, 0],
		[0.22, 0.04],
		[0.06, 0.1],
		[0.05, 0.4],
		[0.08, 0.67],
		[0.001, 0.7],
	];

	it("oriente vers l'extérieur un pied fin à base large", () => {
		expect(signedVolume(meterLathe(chessFoot))).toBeGreaterThan(0);
	});

	it("donne le même résultat quel que soit le sens du profil", () => {
		const reversed = [...chessFoot].reverse();
		expect(signedVolume(meterLathe(reversed))).toBeGreaterThan(0);
	});

	it("garde l'orientation d'un profil fermé sur l'axe", () => {
		const vase: [number, number][] = [
			[0.001, 0],
			[0.15, 0.02],
			[0.17, 0.3],
			[0.001, 0.32],
		];
		expect(signedVolume(meterLathe(vase))).toBeGreaterThan(0);
	});
});
