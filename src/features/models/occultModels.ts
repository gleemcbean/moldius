import type { MaterialId, OccultId } from "@shared/config/occult";
import * as THREE from "three";
import type { MaterialOptions } from "../world/MaterialLibrary";
import type { ModelKit } from "./modelKit";

type Add = (
	geometry: THREE.BufferGeometry,
	material: MaterialOptions,
	x?: number,
	y?: number,
	z?: number,
	rx?: number,
	ry?: number,
	rz?: number,
) => void;

const BRASS: MaterialOptions = {
	texture: "brass",
	color: 0xffd98a,
	roughness: 0.4,
	metalness: 0.35,
	emissive: 0x7a5410,
	emissiveIntensity: 0.7,
};
const DARK_IRON: MaterialOptions = {
	texture: "iron",
	roughness: 0.6,
	metalness: 0.25,
};
const ROCK: MaterialOptions = { texture: "stoneSmooth", roughness: 0.95 };
const BONE: MaterialOptions = {
	color: 0xe8dfc4,
	roughness: 0.7,
	emissive: 0x4a4230,
	emissiveIntensity: 0.45,
};
const BONE_SHADE: MaterialOptions = {
	color: 0xe2d6b6,
	roughness: 0.75,
	emissive: 0x423a26,
	emissiveIntensity: 0.45,
};
const BONE_DARK: MaterialOptions = { color: 0xa8976f, roughness: 0.9 };
const SOOT: MaterialOptions = { color: 0x241a12, roughness: 0.9 };
const LEATHER: MaterialOptions = { texture: "leather", roughness: 0.8 };
const SILVER: MaterialOptions = {
	color: 0xdcecf6,
	roughness: 0.15,
	metalness: 0.45,
	emissive: 0x4d6a7c,
	emissiveIntensity: 0.6,
};
const BLACK_GLASS: MaterialOptions = {
	color: 0x12101c,
	roughness: 0.1,
	metalness: 0.3,
	emissive: 0x1a1030,
	emissiveIntensity: 0.6,
};

function gem(color: number, glow = 0.55): MaterialOptions {
	return {
		color,
		roughness: 0.15,
		metalness: 0.1,
		emissive: color,
		emissiveIntensity: glow,
	};
}

const AMETHYST = gem(0xa45cff, 0.35);
const AMETHYST_PALE = gem(0xc9a0ff, 0.45);
const RUBY = gem(0xff2a4d, 0.22);
const JADE = gem(0x2fd07f, 0.25);
const JADE_DARK = gem(0x0f7044, 0.35);

function faceted(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
	const flat = geometry.index ? geometry.toNonIndexed() : geometry;
	flat.computeVertexNormals();
	return flat;
}

function crystal(radius: number, height: number): THREE.BufferGeometry {
	return faceted(
		new THREE.LatheGeometry(
			[
				[0.001, 0],
				[radius * 0.82, 0.002],
				[radius, height * 0.12],
				[radius * 0.86, height * 0.72],
				[0.001, height],
			].map(([x, y]) => new THREE.Vector2(x, y)),
			6,
		),
	);
}

function rockBase(radius: number, seed: number): THREE.BufferGeometry {
	const geometry = new THREE.IcosahedronGeometry(radius, 1);
	const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
	for (let index = 0; index < positions.count; index += 1) {
		const wobble =
			0.78 +
			0.3 *
				Math.abs(
					Math.sin(positions.getX(index) * 37 + seed) *
						Math.cos(positions.getZ(index) * 41 + seed),
				);
		positions.setXYZ(
			index,
			positions.getX(index) * wobble,
			positions.getY(index) * wobble * 0.5,
			positions.getZ(index) * wobble,
		);
	}
	return faceted(geometry);
}

function brilliant(radius: number): THREE.BufferGeometry {
	return faceted(
		new THREE.LatheGeometry(
			[
				[0.001, -radius * 0.85],
				[radius, 0],
				[radius * 0.98, radius * 0.08],
				[radius * 0.6, radius * 0.42],
				[0.001, radius * 0.42],
			].map(([x, y]) => new THREE.Vector2(x, y)),
			8,
		),
	);
}

function gear(
	radius: number,
	teeth: number,
	depth: number,
	hole: number,
): THREE.BufferGeometry {
	const shape = new THREE.Shape();
	const steps = teeth * 4;
	for (let index = 0; index < steps; index += 1) {
		const angle = (index / steps) * Math.PI * 2;
		const high = index % 4 < 2;
		const r = high ? radius : radius * 0.78;
		if (index === 0) {
			shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
		} else {
			shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
		}
	}
	shape.closePath();
	const center = new THREE.Path();
	center.absarc(0, 0, hole, 0, Math.PI * 2, true);
	shape.holes.push(center);
	for (let spoke = 0; spoke < 4; spoke += 1) {
		const angle = (spoke / 4) * Math.PI * 2 + Math.PI / 4;
		const window = new THREE.Path();
		window.absarc(
			Math.cos(angle) * radius * 0.5,
			Math.sin(angle) * radius * 0.5,
			radius * 0.13,
			0,
			Math.PI * 2,
			true,
		);
		shape.holes.push(window);
	}
	return new THREE.ExtrudeGeometry(shape, {
		depth,
		bevelEnabled: true,
		bevelSize: depth * 0.18,
		bevelThickness: depth * 0.18,
		bevelSegments: 1,
		curveSegments: 10,
	});
}

function shard(
	points: [number, number][],
	depth: number,
): THREE.BufferGeometry {
	const shape = new THREE.Shape(
		points.map(([x, y]) => new THREE.Vector2(x, y)),
	);
	return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function pentagon(radius: number, depth: number): THREE.BufferGeometry {
	return new THREE.CylinderGeometry(radius, radius, depth, 5);
}

function amethyst(add: Add): void {
	add(rockBase(0.1, 3), ROCK, 0, 0.03, 0);
	add(crystal(0.036, 0.2), AMETHYST, 0, 0.03, 0, 0.05, 0, -0.06);
	add(crystal(0.028, 0.15), AMETHYST_PALE, 0.05, 0.03, 0.015, 0.1, 0.5, -0.42);
	add(crystal(0.025, 0.13), AMETHYST, -0.05, 0.03, 0.02, 0.22, 1, 0.48);
	add(crystal(0.021, 0.1), AMETHYST_PALE, 0.012, 0.03, -0.055, -0.48, 2, 0.08);
	add(crystal(0.017, 0.08), AMETHYST, -0.02, 0.03, 0.06, 0.55, 0.3, 0.1);
}

function ruby(add: Add): void {
	add(
		new THREE.TorusGeometry(0.075, 0.012, 6, 14, Math.PI * 1.45),
		BRASS,
		0,
		0.09,
		0,
		0,
		0,
		-0.5,
	);
	add(brilliant(0.06), RUBY, 0, 0.09, 0, Math.PI / 2 - 0.25, 0, 0);
	for (const angle of [0.4, 2.2, 3.9]) {
		add(
			new THREE.BoxGeometry(0.01, 0.034, 0.012),
			BRASS,
			Math.cos(angle) * 0.058,
			0.09 + Math.sin(angle) * 0.058,
			0.008,
			0,
			0,
			angle - Math.PI / 2,
		);
	}
	add(
		new THREE.BoxGeometry(0.024, 0.05, 0.014),
		BRASS,
		0.02,
		0.02,
		0,
		0,
		0,
		-0.3,
	);
}

function jade(add: Add): void {
	add(
		shard(
			[
				[-0.09, -0.06],
				[-0.03, 0.09],
				[0.03, 0.05],
				[0.06, 0.1],
				[0.1, -0.02],
				[0.03, -0.09],
			],
			0.026,
		),
		JADE,
		0,
		0.09,
		-0.013,
		-0.25,
		0.2,
		0,
	);
	add(
		new THREE.TorusGeometry(0.05, 0.006, 5, 14),
		JADE_DARK,
		0.004,
		0.09,
		0.016,
		-0.25,
		0.2,
		0,
	);
	add(new THREE.OctahedronGeometry(0.018), BRASS, 0.004, 0.09, 0.02, 0, 0.5, 0);
	add(
		new THREE.BoxGeometry(0.052, 0.006, 0.004),
		JADE_DARK,
		-0.012,
		0.045,
		0.012,
		-0.25,
		0.2,
		0.35,
	);
	add(
		new THREE.BoxGeometry(0.04, 0.006, 0.004),
		JADE_DARK,
		0.03,
		0.135,
		0.03,
		-0.25,
		0.2,
		-0.3,
	);
}

function mirror(add: Add): void {
	const points: [number, number][] = [
		[-0.08, -0.08],
		[0.09, -0.08],
		[0.1, 0.05],
		[0.03, 0.03],
		[0.0, 0.13],
		[-0.05, 0.02],
	];
	add(shard(points, 0.006), DARK_IRON, 0, 0.1, -0.012, -0.22, 0.25, 0);
	add(shard(points, 0.004), SILVER, 0, 0.1, -0.006, -0.22, 0.25, 0);
	add(
		new THREE.BoxGeometry(0.21, 0.022, 0.024),
		BRASS,
		0.005,
		0.02,
		0.015,
		-0.22,
		0.25,
		0,
	);
	add(
		new THREE.BoxGeometry(0.022, 0.1, 0.024),
		BRASS,
		-0.092,
		0.06,
		0.03,
		-0.22,
		0.25,
		0.04,
	);
	add(new THREE.SphereGeometry(0.018, 8, 6), BRASS, -0.09, 0.02, 0.035);
	add(
		new THREE.BoxGeometry(0.004, 0.09, 0.002),
		{ ...SILVER, emissiveIntensity: 1.1 },
		0.03,
		0.09,
		0.01,
		-0.22,
		0.25,
		0.5,
	);
}

function brass(add: Add): void {
	add(gear(0.09, 10, 0.02, 0.018), BRASS, 0, 0.1, -0.01, -0.25, 0.25, 0);
	add(
		new THREE.CylinderGeometry(0.018, 0.018, 0.05, 10),
		DARK_IRON,
		0,
		0.1,
		0,
		Math.PI / 2 - 0.25,
		0,
		0,
	);
	add(
		gear(0.048, 8, 0.016, 0.01),
		{ ...BRASS, color: 0xf0b860 },
		0.095,
		0.05,
		0.01,
		-0.25,
		0.25,
		0.3,
	);
	add(
		new THREE.CylinderGeometry(0.006, 0.006, 0.09, 6),
		DARK_IRON,
		-0.08,
		0.03,
		0.03,
		0,
		0,
		1.2,
	);
}

function boneShaft(half: number): THREE.BufferGeometry {
	const curve = new THREE.SplineCurve(
		(
			[
				[0.031, -half],
				[0.024, -half * 0.74],
				[0.0165, -half * 0.36],
				[0.0145, 0],
				[0.0165, half * 0.36],
				[0.026, half * 0.74],
				[0.036, half],
			] as const
		).map(([radius, y]) => new THREE.Vector2(radius, y)),
	);
	const geometry = new THREE.LatheGeometry(curve.getPoints(22), 14);
	geometry.rotateZ(-Math.PI / 2);
	const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
	for (let index = 0; index < positions.count; index += 1) {
		const along = positions.getX(index) / half;
		positions.setY(
			index,
			positions.getY(index) + 0.012 * (1 - along * along) - 0.006,
		);
	}
	geometry.computeVertexNormals();
	return geometry;
}

function bone(add: Add): void {
	const half = 0.13;
	const lift = 0.04;
	add(boneShaft(half), BONE, 0, lift, 0);
	for (const side of [-1, 1]) {
		const condyle = new THREE.SphereGeometry(0.034, 12, 10);
		condyle.scale(1.15, 0.92, 0.82);
		add(condyle, BONE_SHADE, half + 0.008, lift - 0.002, side * 0.022);
	}
	const kneeGroove = new THREE.BoxGeometry(0.052, 0.012, 0.007);
	add(kneeGroove, BONE_DARK, half + 0.014, lift + 0.024, 0);
	add(
		new THREE.CylinderGeometry(0.016, 0.022, 0.066, 10),
		BONE,
		-half - 0.014,
		lift + 0.022,
		0,
		0,
		0,
		Math.PI / 4,
	);
	add(
		new THREE.SphereGeometry(0.031, 14, 12),
		BONE_SHADE,
		-half - 0.036,
		lift + 0.05,
		0,
	);
	const trochanter = new THREE.SphereGeometry(0.027, 10, 8);
	trochanter.scale(1.25, 0.95, 0.85);
	add(trochanter, BONE_SHADE, -half - 0.01, lift - 0.012, 0);
	for (const [x, angle] of [
		[-0.062, 0.7],
		[-0.05, -0.7],
		[-0.012, 0.25],
		[0, -1.1],
		[0.012, 0.25],
		[0.05, 1.3],
		[0.062, -0.4],
	] as const) {
		add(
			new THREE.BoxGeometry(0.024, 0.003, 0.0045),
			SOOT,
			x,
			lift + 0.0215 - x * x * 0.7,
			0,
			0,
			angle,
			0,
		);
	}
	add(
		faceted(new THREE.TetrahedronGeometry(0.018)),
		BONE,
		0.045,
		0.012,
		0.06,
		0.4,
		0.9,
		0.2,
	);
	add(
		faceted(new THREE.TetrahedronGeometry(0.011)),
		BONE_SHADE,
		-0.03,
		0.008,
		-0.055,
		1.1,
		0.2,
		0.5,
	);
}

function pendulum(add: Add): void {
	add(new THREE.TorusGeometry(0.03, 0.006, 6, 16), BRASS, 0, 0.42, 0);
	add(new THREE.CylinderGeometry(0.003, 0.003, 0.26, 5), BRASS, 0, 0.27, 0);
	add(new THREE.ConeGeometry(0.02, 0.03, 6), BRASS, 0, 0.13, 0, Math.PI, 0, 0);
	add(crystal(0.05, 0.13), AMETHYST, 0, 0.12, 0, Math.PI, 0, 0);
}

function blackMirror(add: Add): void {
	add(
		new THREE.CylinderGeometry(0.13, 0.13, 0.012, 24),
		BLACK_GLASS,
		0,
		0.26,
		0.004,
		Math.PI / 2,
		0,
		0,
	);
	add(new THREE.TorusGeometry(0.135, 0.016, 8, 24), BRASS, 0, 0.26, 0);
	add(new THREE.CylinderGeometry(0.016, 0.022, 0.13, 10), LEATHER, 0, 0.07, 0);
	add(new THREE.SphereGeometry(0.024, 10, 8), BRASS, 0, 0.13, 0);
	add(crystal(0.016, 0.03), gem(0xe8dfc4, 0.5), 0, 0.395, 0);
}

function boneBell(add: Add): void {
	add(
		new THREE.LatheGeometry(
			[
				[0.1, 0],
				[0.085, 0.02],
				[0.06, 0.09],
				[0.05, 0.15],
				[0.02, 0.18],
				[0.001, 0.18],
			].map(([x, y]) => new THREE.Vector2(x, y)),
			16,
		),
		{ ...BONE, side: THREE.DoubleSide },
		0,
		0.05,
		0,
	);
	add(
		new THREE.TorusGeometry(0.076, 0.004, 4, 16),
		SOOT,
		0,
		0.1,
		0,
		Math.PI / 2,
	);
	add(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), BONE, 0, 0.255, 0);
	add(new THREE.TorusGeometry(0.024, 0.006, 6, 12), BRASS, 0, 0.3, 0);
	add(new THREE.SphereGeometry(0.018, 8, 6), BRASS, 0, 0.04, 0);
}

function rubySeal(add: Add): void {
	add(new THREE.CylinderGeometry(0.11, 0.12, 0.03, 16), BRASS, 0, 0.015, 0);
	add(new THREE.CylinderGeometry(0.03, 0.05, 0.1, 8), DARK_IRON, 0, 0.08, 0);
	add(new THREE.SphereGeometry(0.04, 10, 8), BRASS, 0, 0.15, 0);
	add(brilliant(0.05), RUBY, 0, 0.215, 0);
	add(pentagon(0.05, 0.012), JADE, 0, 0.034, 0.05);
}

function jadeEye(add: Add): void {
	add(
		new THREE.SphereGeometry(0.1, 16, 12),
		{ ...JADE, emissiveIntensity: 0.3 },
		0,
		0.13,
		0,
	);
	add(
		new THREE.CircleGeometry(0.052, 18),
		gem(0xe8f6c8, 0.5),
		0,
		0.15,
		0.094,
		-0.2,
	);
	add(
		new THREE.CircleGeometry(0.024, 14),
		{ color: 0x051a10, roughness: 0.1 },
		0,
		0.152,
		0.098,
		-0.2,
	);
	add(
		new THREE.TorusGeometry(0.104, 0.008, 6, 22),
		BRASS,
		0,
		0.13,
		0,
		Math.PI / 2 - 0.5,
	);
	add(new THREE.CylinderGeometry(0.06, 0.08, 0.04, 10), DARK_IRON, 0, 0.02, 0);
}

function censer(add: Add): void {
	add(
		new THREE.SphereGeometry(
			0.09,
			14,
			10,
			0,
			Math.PI * 2,
			Math.PI / 2,
			Math.PI / 2,
		),
		{ ...BRASS, side: THREE.DoubleSide },
		0,
		0.13,
		0,
	);
	add(
		new THREE.SphereGeometry(0.086, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4),
		{ ...DARK_IRON, side: THREE.DoubleSide },
		0,
		0.135,
		0,
	);
	add(
		new THREE.TorusGeometry(0.09, 0.007, 6, 18),
		BRASS,
		0,
		0.13,
		0,
		Math.PI / 2,
	);
	add(new THREE.CylinderGeometry(0.03, 0.05, 0.03, 10), BRASS, 0, 0.03, 0);
	for (const angle of [0, 2.09, 4.19]) {
		add(
			new THREE.CylinderGeometry(0.0024, 0.0024, 0.27, 4),
			BRASS,
			Math.cos(angle) * 0.045,
			0.3,
			Math.sin(angle) * 0.045,
			Math.sin(angle) * 0.3,
			0,
			-Math.cos(angle) * 0.3,
		);
	}
	add(new THREE.TorusGeometry(0.018, 0.005, 6, 10), BRASS, 0, 0.44, 0);
	add(new THREE.OctahedronGeometry(0.018), RUBY, 0.05, 0.13, 0.078);
	add(new THREE.OctahedronGeometry(0.018), AMETHYST, -0.05, 0.13, 0.078);
}

const MATERIAL_BUILDERS: Record<MaterialId, (add: Add) => void> = {
	amethyst,
	ruby,
	jade,
	mirror,
	brass,
	bone,
};

const OCCULT_BUILDERS: Record<OccultId, (add: Add) => void> = {
	pendulum,
	blackMirror,
	boneBell,
	rubySeal,
	jadeEye,
	censer,
};

function assemble(kit: ModelKit, build: (add: Add) => void): THREE.Group {
	const group = new THREE.Group();
	build((geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
		const mesh = kit.mesh(geometry, material);
		mesh.position.set(x, y, z);
		mesh.rotation.set(rx, ry, rz);
		group.add(mesh);
	});
	return group;
}

export function createMaterialModel(
	kit: ModelKit,
	id: MaterialId,
): THREE.Group {
	return assemble(kit, MATERIAL_BUILDERS[id]);
}

export function createOccultModel(kit: ModelKit, id: OccultId): THREE.Group {
	return assemble(kit, OCCULT_BUILDERS[id]);
}

export function disposeModel(root: THREE.Object3D): void {
	root.traverse((object) => {
		if (object instanceof THREE.Mesh) {
			object.geometry.dispose();
		}
	});
}
