import { DOOR_THICKNESS } from "@shared/manor/doors";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
	DOOR_FIELD_COLOR,
	DOOR_REFERENCE,
	DOOR_WOOD,
	DOOR_WOODS,
} from "../../../src/features/engine/world/DoorViews";
import {
	meterBox,
	meterCylinder,
	meterLathe,
	placed,
	scaleUv,
} from "../../../src/features/world/geometryUtils";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import { roundedBox } from "../furniture/parts";
import { type BuildKit, PartList } from "../kit";
import { attachMorphs, type MorphResult } from "../morph";

const BRASS: MaterialOptions = {
	texture: "brass",
	roughness: 0.35,
	metalness: 0.8,
};
const IRON: MaterialOptions = {
	texture: "iron",
	roughness: 0.5,
	metalness: 0.6,
};
const SHADOW: MaterialOptions = { color: 0x080605, roughness: 1 };

function raisedPanel(width: number, height: number): THREE.BufferGeometry {
	const bevel = Math.min(0.035, width * 0.2, height * 0.2);
	const shape = new THREE.Shape();
	shape.moveTo(-width / 2 + bevel, -height / 2 + bevel);
	shape.lineTo(width / 2 - bevel, -height / 2 + bevel);
	shape.lineTo(width / 2 - bevel, height / 2 - bevel);
	shape.lineTo(-width / 2 + bevel, height / 2 - bevel);
	shape.closePath();
	const thickness = DOOR_THICKNESS - 0.034;
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: thickness,
		bevelEnabled: true,
		bevelThickness: 0.007,
		bevelSize: bevel,
		bevelSegments: 1,
		curveSegments: 1,
	});
	geometry.translate(0, 0, -thickness / 2);
	return geometry;
}

function molding(width: number, height: number): THREE.BufferGeometry {
	const outer = new THREE.Shape();
	outer.moveTo(-width / 2, -height / 2);
	outer.lineTo(width / 2, -height / 2);
	outer.lineTo(width / 2, height / 2);
	outer.lineTo(-width / 2, height / 2);
	outer.closePath();
	const hole = new THREE.Path();
	const inset = 0.012;
	hole.moveTo(-width / 2 + inset, -height / 2 + inset);
	hole.lineTo(-width / 2 + inset, height / 2 - inset);
	hole.lineTo(width / 2 - inset, height / 2 - inset);
	hole.lineTo(width / 2 - inset, -height / 2 + inset);
	hole.closePath();
	outer.holes.push(hole);
	const geometry = new THREE.ExtrudeGeometry(outer, {
		depth: 0.004,
		bevelEnabled: true,
		bevelThickness: 0.004,
		bevelSize: 0.004,
		bevelSegments: 2,
		curveSegments: 1,
	});
	return scaleUv(geometry, 1, 1);
}

function knob(): THREE.BufferGeometry {
	return meterLathe(
		[
			[0.001, 0],
			[0.026, 0],
			[0.027, 0.004],
			[0.022, 0.008],
			[0.009, 0.012],
			[0.0075, 0.03],
			[0.012, 0.036],
			[0.024, 0.046],
			[0.027, 0.056],
			[0.022, 0.066],
			[0.012, 0.071],
			[0.001, 0.072],
		].map(([radius, height]) => new THREE.Vector2(radius, height)),
		24,
	);
}

function keyhole(): THREE.BufferGeometry {
	const shape = new THREE.Shape();
	shape.absarc(0, 0.006, 0.0055, -Math.PI / 4, Math.PI * 1.25, false);
	shape.lineTo(-0.004, -0.014);
	shape.lineTo(0.004, -0.014);
	shape.closePath();
	return new THREE.ShapeGeometry(shape, 8);
}

function mergeParts(pivot: THREE.Group): void {
	const parts = pivot.children;
	const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
	for (const part of parts) {
		if (
			!(part instanceof THREE.Mesh) ||
			Array.isArray(part.material) ||
			part.children.length > 0
		) {
			return;
		}
	}
	for (const part of parts as THREE.Mesh[]) {
		part.updateMatrix();
		const geometry = part.geometry.clone().applyMatrix4(part.matrix);
		const list = groups.get(part.material as THREE.Material);
		if (list) {
			list.push(geometry);
		} else {
			groups.set(part.material as THREE.Material, [geometry]);
		}
	}
	const merged: THREE.Mesh[] = [];
	for (const [material, geometries] of groups) {
		const geometry =
			geometries.length === 1
				? geometries[0]
				: mergeGeometries(geometries, false);
		if (!geometry) {
			for (const list of groups.values()) {
				for (const clone of list) {
					clone.dispose();
				}
			}
			for (const mesh of merged) {
				mesh.geometry.dispose();
			}
			return;
		}
		if (geometries.length > 1) {
			for (const clone of geometries) {
				clone.dispose();
			}
		}
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = false;
		mesh.receiveShadow = false;
		mesh.matrixAutoUpdate = false;
		mesh.updateMatrix();
		merged.push(mesh);
	}
	for (const part of [...parts] as THREE.Mesh[]) {
		part.geometry.dispose();
		pivot.remove(part);
	}
	for (const mesh of merged) {
		pivot.add(mesh);
	}
}

function buildDoorAt(
	kit: BuildKit,
	rows: number,
	length: number,
	height: number,
): THREE.Group {
	const pivot = new THREE.Group();
	const woodOptions: MaterialOptions = { ...DOOR_WOOD, texture: DOOR_WOODS[0] };
	const wood = kit.slot("wood", woodOptions);
	const field = kit.slot("field", { ...woodOptions, color: DOOR_FIELD_COLOR });
	const parts = new PartList();
	const core = DOOR_THICKNESS - 0.024;
	parts.add(
		wood,
		placed(
			meterBox(length - 0.02, height - 0.02, core),
			length / 2,
			height / 2,
			0,
		),
	);
	const stile = Math.min(0.12, length * 0.16);
	for (const x of [stile / 2, length - stile / 2]) {
		parts.add(
			wood,
			placed(
				roundedBox(height, stile, DOOR_THICKNESS, 0.006, 2),
				x,
				height / 2,
				0,
				0,
				0,
				Math.PI / 2,
			),
		);
	}
	const bottomRail = 0.22;
	const topRail = 0.13;
	const middleRail = 0.1;
	const inner = length - stile * 2;
	const panelSpan =
		(height - bottomRail - topRail - middleRail * (rows - 1)) / rows;
	const rails = [bottomRail / 2, height - topRail / 2];
	const railHeights = [bottomRail, topRail];
	for (let row = 1; row < rows; row += 1) {
		rails.push(bottomRail + row * panelSpan + (row - 0.5) * middleRail);
		railHeights.push(middleRail);
	}
	rails.forEach((y, index) => {
		parts.add(
			wood,
			placed(
				roundedBox(
					inner + 0.01,
					railHeights[index],
					DOOR_THICKNESS - 0.004,
					0.005,
					2,
				),
				length / 2,
				y,
				0,
			),
		);
	});
	for (let row = 0; row < rows; row += 1) {
		const y = bottomRail + row * (panelSpan + middleRail) + panelSpan / 2;
		parts.add(
			field,
			placed(raisedPanel(inner - 0.012, panelSpan - 0.012), length / 2, y, 0),
		);
		for (const side of [-1, 1]) {
			parts.add(
				wood,
				placed(
					molding(inner, panelSpan),
					length / 2,
					y,
					side * (DOOR_THICKNESS / 2 - 0.006),
					side === 1 ? 0 : Math.PI,
				),
			);
		}
	}
	const handleX = length - 0.09;
	for (const side of [-1, 1]) {
		const face = side * (DOOR_THICKNESS / 2);
		parts.add(
			BRASS,
			placed(
				roundedBox(0.056, 0.2, 0.006, 0.002, 2),
				handleX,
				0.99,
				face + side * 0.003,
			),
		);
		parts.add(
			BRASS,
			placed(
				knob(),
				handleX,
				1.02,
				face + side * 0.006,
				side === 1 ? 0 : Math.PI,
				Math.PI / 2,
			),
		);
		parts.add(
			SHADOW,
			placed(
				keyhole(),
				handleX,
				0.93,
				face + side * 0.0062,
				side === 1 ? 0 : Math.PI,
			),
		);
	}
	for (const y of rows === 3
		? [0.22, height / 2, height - 0.22]
		: [0.25, height - 0.25]) {
		parts.add(
			IRON,
			placed(meterCylinder(0.016, 0.016, 0.13, 12), -0.002, y, 0),
		);
		parts.add(
			IRON,
			placed(meterCylinder(0.006, 0.01, 0.018, 10), -0.002, y + 0.074, 0),
		);
		parts.add(
			IRON,
			placed(meterCylinder(0.01, 0.006, 0.018, 10), -0.002, y - 0.074, 0),
		);
		for (const side of [-1, 1]) {
			parts.add(
				IRON,
				placed(
					roundedBox(0.09, 0.1, 0.004, 0.0015),
					0.045,
					y,
					side * (DOOR_THICKNESS / 2 + 0.002),
				),
			);
		}
	}
	parts.build(kit, pivot);
	mergeParts(pivot);
	return pivot;
}

export function buildDoor(
	kit: BuildKit,
	rows: number,
	name: string,
): { root: THREE.Group; morphs: MorphResult } {
	const { width, height } = DOOR_REFERENCE;
	const root = buildDoorAt(kit, rows, width, height);
	root.name = name;
	root.userData.reference = { width, height };
	const morphs = attachMorphs(root, [
		{
			name: "width",
			step: 0.1,
			build: (delta) => buildDoorAt(kit, rows, width + delta, height),
		},
		{
			name: "height",
			step: 0.1,
			build: (delta) => buildDoorAt(kit, rows, width, height + delta),
		},
	]);
	return { root, morphs };
}
