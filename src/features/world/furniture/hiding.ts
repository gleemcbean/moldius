import {
	CASK_CRADLE,
	caskCenter,
	caskRadius,
	TRUNK_LID,
} from "@shared/manor/hideProfiles";
import { plankDisc } from "@shared/plankDisc";
import * as THREE from "three";
import { meterBox, meterCircle, meterLathe } from "../geometryUtils";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	BRASS,
	box,
	boxAt,
	cylinderBetween,
	type FurnitureBuilder,
	IRON,
	type Part,
	pickWood,
	torus,
} from "./parts";

const SHELL = 0.035;
const VELVETS = [
	"velvetRed",
	"velvetGreen",
	"velvetPurple",
	"velvetBlue",
] as const;

function hinged(
	geometry: THREE.BufferGeometry,
	angle: number,
	hingeY: number,
	hingeZ: number,
) {
	geometry.rotateX(-angle);
	geometry.translate(0, hingeY, hingeZ);
	return geometry;
}

export const trunk: FurnitureBuilder = ({ item, rng }) => {
	const { width, height, depth } = item;
	const leather: MaterialOptions = {
		texture: "leather",
		color: rng.pick([0xc89a70, 0xa8805e, 0x98a4ae]),
		roughness: 0.75,
	};
	const wood = pickWood(rng);
	const lining: MaterialOptions = {
		texture: rng.pick(VELVETS),
		roughness: 1,
		color: 0x9a8a8a,
	};
	const body = height - TRUNK_LID;
	const parts: Part[] = [
		box(wood, width, SHELL, depth, 0, 0.04, 0),
		box(leather, width, body - 0.04, SHELL, 0, 0.04, depth / 2 - SHELL / 2),
		box(leather, width, body - 0.04, SHELL, 0, 0.04, -depth / 2 + SHELL / 2),
		box(
			leather,
			SHELL,
			body - 0.04,
			depth - SHELL * 2,
			-width / 2 + SHELL / 2,
			0.04,
			0,
		),
		box(
			leather,
			SHELL,
			body - 0.04,
			depth - SHELL * 2,
			width / 2 - SHELL / 2,
			0.04,
			0,
		),
		box(lining, width - SHELL * 2, 0.01, depth - SHELL * 2, 0, 0.04 + SHELL, 0),
		box(
			lining,
			width - SHELL * 2,
			body - 0.1,
			0.008,
			0,
			0.08,
			-depth / 2 + SHELL + 0.004,
		),
	];
	for (const x of [-width / 2 + 0.06, width / 2 - 0.06]) {
		for (const z of [-depth / 2 + 0.06, depth / 2 - 0.06]) {
			parts.push(box(IRON, 0.07, 0.04, 0.07, x, 0, z));
		}
	}
	for (const x of [-width * 0.3, width * 0.3]) {
		parts.push(box(wood, 0.06, body - 0.04, 0.012, x, 0.04, depth / 2 + 0.006));
		parts.push(
			box(wood, 0.06, body - 0.04, 0.012, x, 0.04, -depth / 2 - 0.006),
		);
	}
	for (const side of [-1, 1]) {
		parts.push(
			box(
				BRASS,
				0.012,
				0.05,
				depth * 0.85,
				side * (width / 2 + 0.006),
				body - 0.08,
				0,
			),
		);
		parts.push(
			torus(
				IRON,
				0.05,
				0.008,
				side * (width / 2 + 0.02),
				body * 0.6,
				0,
				0,
				Math.PI / 2,
			),
		);
	}
	for (const z of [-depth / 2, depth / 2]) {
		parts.push(box(BRASS, width + 0.012, 0.025, 0.012, 0, body - 0.025, z));
	}
	for (const x of [-width / 2, width / 2]) {
		parts.push(box(BRASS, 0.012, 0.025, depth + 0.012, x, body - 0.025, 0));
	}

	const angle = 0.21;
	const slab = meterBox(width + 0.02, 0.045, depth + 0.02);
	slab.translate(0, 0.0225, (depth + 0.02) / 2);
	parts.push({
		geometry: hinged(slab, angle, body, -depth / 2 - 0.01),
		material: leather,
	});
	const dome = new THREE.CylinderGeometry(
		depth / 2,
		depth / 2,
		width,
		16,
		1,
		false,
		0,
		Math.PI,
	);
	dome.rotateZ(Math.PI / 2);
	dome.scale(1, (TRUNK_LID - 0.045) / (depth / 2), 1);
	dome.translate(0, 0.045, depth / 2);
	parts.push({
		geometry: hinged(dome, angle, body, -depth / 2),
		material: leather,
	});
	const underside = meterBox(width - 0.04, 0.008, depth - 0.04);
	underside.translate(0, -0.004, depth / 2);
	parts.push({
		geometry: hinged(underside, angle, body, -depth / 2),
		material: lining,
	});
	for (const x of [-width * 0.3, width * 0.3]) {
		const band = meterBox(0.065, TRUNK_LID + 0.01, 0.02);
		band.translate(x, TRUNK_LID / 2, depth + 0.01);
		parts.push({
			geometry: hinged(band, angle, body, -depth / 2 - 0.01),
			material: wood,
		});
	}
	const clasp = meterBox(0.09, 0.11, 0.02);
	clasp.translate(0, -0.03, depth + 0.02);
	parts.push({
		geometry: hinged(clasp, angle, body, -depth / 2 - 0.01),
		material: BRASS,
	});
	return parts;
};

export const curtainAlcove: FurnitureBuilder = ({ item, rng }) => {
	const { width, height, depth } = item;
	const wood: MaterialOptions = { texture: "woodDark", roughness: 0.85 };
	const velvet: MaterialOptions = {
		wave: "cloth",
		texture: rng.pick(VELVETS),
		roughness: 1,
	};
	const parts: Part[] = [
		box(
			{ texture: "woodPanels", color: 0x7a6a5a, roughness: 0.9 },
			width,
			height - 0.3,
			0.03,
			0,
			0,
			-depth / 2 + 0.015,
		),
		box(wood, 0.09, height, depth, -width / 2 + 0.045, 0, 0),
		box(wood, 0.09, height, depth, width / 2 - 0.045, 0, 0),
		box(wood, width, 0.24, depth, 0, height - 0.24, 0),
		box(wood, width + 0.06, 0.05, depth + 0.04, 0, height - 0.05, 0.02),
		box(wood, width + 0.04, 0.03, depth + 0.03, 0, height - 0.27, 0.015),
	];
	const rodY = height - 0.31;
	const rodZ = depth / 2 - 0.12;
	parts.push(
		cylinderBetween(
			BRASS,
			new THREE.Vector3(-width / 2 + 0.09, rodY, rodZ),
			new THREE.Vector3(width / 2 - 0.09, rodY, rodZ),
			0.016,
		),
	);
	const gap = 0.14;
	const inner = width / 2 - 0.09;
	const drapeWidth = inner - gap / 2;
	const folds = Math.max(4, Math.round(drapeWidth / 0.085));
	const fold = drapeWidth / folds;
	const drop = rodY - 0.02;
	for (const side of [-1, 1]) {
		for (let index = 0; index < folds; index += 1) {
			const x = side * (gap / 2 + fold * (index + 0.5));
			const wave = index % 2 === 0 ? 1 : -1;
			parts.push(
				boxAt(
					velvet,
					fold * 1.18,
					drop,
					0.03,
					x,
					drop / 2,
					rodZ + wave * 0.022,
					0,
					wave * side * 0.42,
				),
			);
		}
		parts.push(
			cylinderBetween(
				BRASS,
				new THREE.Vector3(side * (gap / 2 + 0.02), rodY - 0.02, rodZ),
				new THREE.Vector3(side * (inner - 0.02), rodY - 0.02, rodZ),
				0.008,
			),
		);
	}
	parts.push(
		box(
			{ ...velvet, color: 0xb0a070 },
			width - 0.2,
			0.05,
			0.02,
			0,
			height - 0.32,
			depth / 2 - 0.01,
		),
	);
	return parts;
};

export const cask: FurnitureBuilder = ({ item }) => {
	const { width, height, depth } = item;
	const radius = caskRadius(width, height);
	const center = caskCenter(width, height);
	const staves: MaterialOptions = {
		texture: "woodMedium",
		roughness: 0.9,
		side: THREE.DoubleSide,
	};
	const heads: MaterialOptions = {
		texture: "woodDark",
		roughness: 0.9,
		side: THREE.DoubleSide,
	};
	const length = depth - 0.04;
	const profile: THREE.Vector2[] = [];
	for (let step = 0; step <= 8; step += 1) {
		const t = step / 8;
		profile.push(
			new THREE.Vector2(
				radius * (0.86 + 0.14 * Math.sin(t * Math.PI)),
				-length / 2 + t * length,
			),
		);
	}
	const body = meterLathe(profile, 28);
	body.rotateX(Math.PI / 2);
	body.translate(0, center, 0);
	const parts: Part[] = [{ geometry: body, material: staves }];
	for (const t of [0.04, 0.2, 0.8, 0.96]) {
		const ring = radius * (0.86 + 0.14 * Math.sin(t * Math.PI)) + 0.01;
		parts.push(
			torus(IRON, ring, 0.016, 0, center, -length / 2 + t * length, 0),
		);
	}
	const staveRadius = (z: number) =>
		radius * (0.86 + 0.14 * Math.sin(((z + length / 2) / length) * Math.PI));
	const backZ = -length / 2 + 0.05;
	const back = meterCircle(staveRadius(backZ), 28);
	back.translate(0, center, backZ);
	parts.push({ geometry: back, material: heads });

	const frontZ = length / 2 - 0.05;
	const headDepth = 0.045;
	const headRadius = staveRadius(frontZ + headDepth / 2);
	const count = Math.ceil((headRadius * 2) / 0.12);
	const plank = (headRadius * 2) / count;
	const hatchPlanks = Math.floor(Math.min(0.56, headRadius * 0.9) / plank);
	const hatchWidth =
		plank *
		Math.max(
			count % 2 === 0 ? 2 : 1,
			hatchPlanks - ((hatchPlanks + count) % 2),
		);
	const hatchBottom = center - 0.34;
	const hatchTop = center + 0.3;
	for (const outline of plankDisc(headRadius, count, 0.004, {
		halfWidth: hatchWidth / 2,
		bottom: hatchBottom - center,
		top: hatchTop - center,
	})) {
		const geometry = new THREE.ExtrudeGeometry(
			new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))),
			{ depth: headDepth, bevelEnabled: false },
		);
		geometry.translate(0, center, frontZ - headDepth / 2);
		parts.push({ geometry, material: heads });
	}
	parts.push(
		box(IRON, hatchWidth + 0.04, 0.03, 0.05, 0, hatchBottom - 0.03, frontZ),
	);
	parts.push(box(IRON, hatchWidth + 0.04, 0.03, 0.05, 0, hatchTop, frontZ));
	const doorAngle = 0.62;
	const hingeX = -hatchWidth / 2;
	const doorZ = frontZ + 0.03;
	const doorCenterX = hingeX + Math.cos(doorAngle) * (hatchWidth / 2);
	const doorCenterZ = doorZ + Math.sin(doorAngle) * (hatchWidth / 2);
	parts.push(
		boxAt(
			heads,
			hatchWidth,
			hatchTop - hatchBottom,
			0.04,
			doorCenterX,
			(hatchTop + hatchBottom) / 2,
			doorCenterZ,
			0,
			-doorAngle,
		),
	);
	for (const y of [hatchBottom + 0.1, hatchTop - 0.1]) {
		parts.push(
			boxAt(
				IRON,
				hatchWidth * 0.8,
				0.03,
				0.01,
				doorCenterX - Math.sin(doorAngle) * 0.022,
				y,
				doorCenterZ + Math.cos(doorAngle) * 0.022,
				0,
				-doorAngle,
			),
		);
	}
	parts.push(
		cylinderBetween(
			BRASS,
			new THREE.Vector3(0, hatchBottom - 0.16, frontZ + 0.02),
			new THREE.Vector3(0, hatchBottom - 0.16, frontZ + 0.13),
			0.022,
		),
	);
	const cradle: MaterialOptions = { texture: "woodDark", roughness: 0.95 };
	for (const z of [-length * 0.32, length * 0.32]) {
		parts.push(box(cradle, radius * 1.8, CASK_CRADLE - 0.01, 0.16, 0, 0, z));
		for (const side of [-1, 1]) {
			parts.push(
				box(
					cradle,
					radius * 0.3,
					center - radius * 0.72,
					0.16,
					side * radius * 0.78,
					0,
					z,
				),
			);
		}
	}
	for (const side of [-1, 1]) {
		parts.push(
			box(cradle, 0.12, 0.12, length * 0.85, side * radius * 0.7, 0, 0),
		);
	}
	return parts;
};
