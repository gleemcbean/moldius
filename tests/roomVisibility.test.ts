import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { pointInPolygon } from "../shared/manor/polygon.js";
import type { ManorLayout } from "../shared/manor/types.js";
import { allFixtures, SEEDS } from "./helpers/manorFixtures.js";

interface Visibility {
	readonly visible: Uint8Array;
	update(
		camera: THREE.PerspectiveCamera,
		eye: THREE.Vector3,
		shut: (doorId: number) => boolean,
	): boolean;
}

const clientRoot = "../src";

const { RoomVisibility } = (await import(
	`${clientRoot}/features/engine/world/RoomVisibility.ts`
)) as {
	RoomVisibility: new (layout: ManorLayout) => Visibility;
};

function aim(
	camera: THREE.PerspectiveCamera,
	eye: THREE.Vector3,
	target: THREE.Vector3,
): void {
	camera.position.copy(eye);
	camera.lookAt(target);
	camera.updateMatrixWorld(true);
}

function camera(): THREE.PerspectiveCamera {
	return new THREE.PerspectiveCamera(75, 16 / 9, 0.03, 90);
}

const open = () => false;

describe("visibilité des pièces par portails", () => {
	it("la pièce occupée est toujours visible, quelle que soit la direction", () => {
		const view = camera();
		let checked = 0;

		for (const fixture of allFixtures(SEEDS.slice(0, 4))) {
			const visibility = new RoomVisibility(fixture.layout);

			for (const room of fixture.layout.rooms) {
				const point = room.labelPoint;

				if (!pointInPolygon(point, room.polygon)) {
					continue;
				}

				const eye = new THREE.Vector3(point.x, room.floorY + 1.6, point.z);

				for (let step = 0; step < 6; step += 1) {
					const angle = (step / 6) * Math.PI * 2;

					aim(
						view,
						eye,
						eye
							.clone()
							.add(new THREE.Vector3(Math.cos(angle), -0.1, Math.sin(angle))),
					);

					expect(visibility.update(view, eye, open)).toBe(true);
					expect(visibility.visible[room.id]).toBe(1);

					checked += 1;
				}
			}
		}

		expect(checked).toBeGreaterThan(100);
	});

	it("la pièce derrière une ouverture regardée est visible, sauf porte fermée", () => {
		const view = camera();
		let seen = 0;
		let blocked = 0;

		for (const fixture of allFixtures(SEEDS.slice(0, 6))) {
			const { layout } = fixture;
			const visibility = new RoomVisibility(layout);

			for (const opening of layout.openings) {
				const roomA = layout.rooms[opening.roomA];

				const center = {
					x: (opening.start.x + opening.end.x) / 2,
					z: (opening.start.z + opening.end.z) / 2,
				};

				const standing = {
					x: center.x - opening.normal.x * 1.2,
					z: center.z - opening.normal.z * 1.2,
				};

				if (!pointInPolygon(standing, roomA.polygon)) {
					continue;
				}

				const height =
					opening.floorY +
					(opening.kind === "window" ? opening.sill + 0.8 : 1.4);

				const eye = new THREE.Vector3(standing.x, height, standing.z);

				const target = new THREE.Vector3(
					center.x + opening.normal.x * 3,
					height,
					center.z + opening.normal.z * 3,
				);

				aim(view, eye, target);
				expect(visibility.update(view, eye, open)).toBe(true);
				expect(visibility.visible[opening.roomA]).toBe(1);
				expect(visibility.visible[opening.roomB]).toBe(1);

				seen += 1;

				if (opening.door) {
					const doorId = opening.door.id;

					visibility.update(view, eye, (id) => id === doorId);

					const other = layout.openings.some(
						(candidate) =>
							candidate !== opening &&
							((candidate.roomA === opening.roomA &&
								candidate.roomB === opening.roomB) ||
								(candidate.roomA === opening.roomB &&
									candidate.roomB === opening.roomA)),
					);

					if (!other && visibility.visible[opening.roomB] === 0) {
						blocked += 1;
					}
				}
			}
		}

		expect(seen).toBeGreaterThan(50);
		expect(blocked).toBeGreaterThan(5);
	});

	it("ne dessine qu'une partie du manoir depuis l'intérieur", () => {
		const view = camera();
		let total = 0;
		let shown = 0;

		for (const fixture of allFixtures(SEEDS.slice(0, 6))) {
			const { layout } = fixture;
			const visibility = new RoomVisibility(layout);

			for (const room of layout.rooms) {
				const point = room.labelPoint;

				if (!pointInPolygon(point, room.polygon)) {
					continue;
				}

				const eye = new THREE.Vector3(point.x, room.floorY + 1.6, point.z);

				for (let step = 0; step < 4; step += 1) {
					const angle = (step / 4) * Math.PI * 2;

					aim(
						view,
						eye,
						eye
							.clone()
							.add(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))),
					);

					visibility.update(view, eye, open);

					total += layout.rooms.length;
					shown += visibility.visible.reduce((sum, value) => sum + value, 0);
				}
			}
		}

		expect(shown / total).toBeLessThan(0.3);
	});

	it("laisse la main au repli hors du manoir", () => {
		const view = camera();

		for (const fixture of allFixtures(SEEDS.slice(0, 3))) {
			const { layout } = fixture;
			const visibility = new RoomVisibility(layout);
			const eye = new THREE.Vector3(layout.bounds.maxX + 25, 1.6, 0);

			aim(view, eye, new THREE.Vector3(0, 1.6, 0));
			expect(visibility.update(view, eye, open)).toBe(false);
		}
	});
});
