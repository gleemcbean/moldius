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
	color: 0xd9a94c,
	roughness: 0.34,
	metalness: 0.4,
	emissive: 0x7a5410,
	emissiveIntensity: 0.55,
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
const SILVER: MaterialOptions = {
	color: 0xdcecf6,
	roughness: 0.15,
	metalness: 0.45,
	emissive: 0x4d6a7c,
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

const OBSIDIAN: MaterialOptions = {
	color: 0x08060e,
	roughness: 0.06,
	metalness: 0.5,
	emissive: 0x140a26,
	emissiveIntensity: 0.5,
};
const HORN: MaterialOptions = {
	color: 0x8f7555,
	roughness: 0.5,
	emissive: 0x3a2c1c,
	emissiveIntensity: 0.3,
};
const BLADE: MaterialOptions = {
	color: 0xc4ced8,
	roughness: 0.3,
	metalness: 0.35,
	emissive: 0x39424c,
	emissiveIntensity: 0.35,
};
const SCLERA: MaterialOptions = {
	color: 0xd9d4b4,
	roughness: 0.3,
	emissive: 0x6a7a5a,
	emissiveIntensity: 0.2,
};
const IRIS: MaterialOptions = {
	texture: "occultIris",
	alphaTest: 0.5,
	roughness: 0.12,
	emissive: 0xffffff,
	emissiveIntensity: 0.6,
};
const PENTACLE: MaterialOptions = {
	texture: "occultPentacle",
	color: 0x7ab0ff,
	emissive: 0x7ab0ff,
	emissiveIntensity: 1.2,
	roughness: 0.8,
	alphaTest: 0.45,
	side: THREE.DoubleSide,
};
const AMETHYST_GLOW = gem(0xa45cff, 0.65);
const RUBY_GLOW = gem(0xff2a4d, 0.6);
const BLADE_GLOW = gem(0xff2a4d, 1.2);
const EYE_GLOW = gem(0xff4a1e, 1.6);
const OBJECT_BRASS: MaterialOptions = { ...BRASS, emissiveIntensity: 0.3 };
const OBJECT_BONE: MaterialOptions = { ...BONE, emissiveIntensity: 0.25 };
const OBJECT_BONE_SHADE: MaterialOptions = {
	...BONE_SHADE,
	emissiveIntensity: 0.25,
};

function ring(radius: number, tube: number): THREE.BufferGeometry {
	return new THREE.TorusGeometry(radius, tube, 6, 20);
}

function diamond(radius: number, height: number): THREE.BufferGeometry {
	return faceted(
		new THREE.LatheGeometry(
			[
				[0.001, 0],
				[radius, height * 0.62],
				[0.001, height],
			].map(([x, y]) => new THREE.Vector2(x, y)),
			6,
		),
	);
}

function horn(side: number): THREE.BufferGeometry {
	const curve = new THREE.CatmullRomCurve3([
		new THREE.Vector3(side * 0.08, 0.2, 0),
		new THREE.Vector3(side * 0.14, 0.245, 0),
		new THREE.Vector3(side * 0.165, 0.335, -0.01),
	]);
	const segments = 8;
	const radial = 6;
	const geometry = new THREE.TubeGeometry(curve, segments, 1, radial, false);
	const position = geometry.getAttribute("position") as THREE.BufferAttribute;
	const center = new THREE.Vector3();
	const vertex = new THREE.Vector3();
	for (let step = 0; step <= segments; step += 1) {
		const t = step / segments;
		curve.getPointAt(t, center);
		for (let around = 0; around <= radial; around += 1) {
			const index = step * (radial + 1) + around;
			vertex.fromBufferAttribute(position, index);
			vertex
				.sub(center)
				.multiplyScalar(0.024 * (1 - t) + 0.002 * t)
				.add(center);
			position.setXYZ(index, vertex.x, vertex.y, vertex.z);
		}
	}
	geometry.computeVertexNormals();
	return geometry;
}

function irisDome(radius: number, cap: number): THREE.BufferGeometry {
	const geometry = new THREE.SphereGeometry(
		radius,
		18,
		6,
		0,
		Math.PI * 2,
		0,
		cap,
	);
	geometry.rotateX(Math.PI / 2);
	const position = geometry.getAttribute("position") as THREE.BufferAttribute;
	const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
	const span = radius * Math.sin(cap) * 2;
	for (let index = 0; index < position.count; index += 1) {
		uv.setXY(
			index,
			0.5 + position.getX(index) / span,
			0.5 + position.getY(index) / span,
		);
	}
	return geometry;
}

function pendulum(add: Add): void {
	add(ring(0.045, 0.009), OBJECT_BRASS, 0, 0.4, 0);
	add(
		new THREE.CylinderGeometry(0.004, 0.004, 0.2, 5),
		OBJECT_BRASS,
		0,
		0.255,
		0,
	);
	add(new THREE.ConeGeometry(0.03, 0.04, 6), OBJECT_BRASS, 0, 0.145, 0);
	add(diamond(0.056, 0.135), AMETHYST_GLOW);
}

function blackMirror(add: Add): void {
	const center = 0.25;
	add(
		new THREE.CylinderGeometry(0.13, 0.13, 0.016, 24),
		OBSIDIAN,
		0,
		center,
		0,
		Math.PI / 2,
		0,
		0,
	);
	add(new THREE.CircleGeometry(0.114, 24), PENTACLE, 0, center, 0.0095);
	add(new THREE.TorusGeometry(0.135, 0.016, 6, 24), OBJECT_BRASS, 0, center, 0);
	add(
		new THREE.CylinderGeometry(0.017, 0.024, 0.125, 8),
		OBJECT_BONE,
		0,
		0.0625,
		0,
	);
}

function runeSkull(add: Add): void {
	const cranium = new THREE.SphereGeometry(0.105, 12, 10);
	cranium.scale(1, 0.98, 1.12);
	add(cranium, OBJECT_BONE, 0, 0.15, 0);
	add(
		new THREE.BoxGeometry(0.1, 0.06, 0.09),
		OBJECT_BONE_SHADE,
		0,
		0.045,
		0.045,
	);
	add(new THREE.ConeGeometry(0.016, 0.03, 3), SOOT, 0, 0.09, 0.106);
	for (const side of [-1, 1]) {
		const socket = new THREE.SphereGeometry(0.03, 8, 6);
		socket.scale(1, 0.95, 0.5);
		add(socket, SOOT, side * 0.04, 0.128, 0.098);
		add(
			new THREE.SphereGeometry(0.011, 6, 5),
			EYE_GLOW,
			side * 0.04,
			0.128,
			0.106,
		);
		add(horn(side), HORN);
	}
}

function athame(add: Add): void {
	const blade = new THREE.ConeGeometry(0.032, 0.34, 4);
	blade.scale(1, 1, 0.24);
	add(blade, BLADE, 0, 0.35, 0);
	const fuller = new THREE.ConeGeometry(0.008, 0.27, 4);
	fuller.scale(1, 1, 1.1);
	add(fuller, BLADE_GLOW, 0, 0.315, 0);
	add(
		new THREE.TorusGeometry(0.052, 0.011, 6, 12, Math.PI),
		OBJECT_BRASS,
		0,
		0.225,
		0,
		0,
		0,
		Math.PI,
	);
	add(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 6), JADE_DARK, 0, 0.11, 0);
	add(faceted(new THREE.IcosahedronGeometry(0.03, 0)), RUBY_GLOW, 0, 0.03, 0);
}

function jadeEye(add: Add): void {
	add(new THREE.CylinderGeometry(0.07, 0.085, 0.03, 8), DARK_IRON, 0, 0.015, 0);
	add(new THREE.SphereGeometry(0.092, 14, 10), SCLERA, 0, 0.115, 0);
	add(irisDome(0.0935, 0.72), IRIS, 0, 0.115, 0);
}

function censer(add: Add): void {
	add(
		new THREE.CylinderGeometry(0.04, 0.06, 0.03, 8),
		OBJECT_BRASS,
		0,
		0.015,
		0,
	);
	add(
		new THREE.SphereGeometry(
			0.112,
			10,
			5,
			0,
			Math.PI * 2,
			Math.PI / 2,
			Math.PI / 2,
		),
		OBJECT_BRASS,
		0,
		0.135,
		0,
	);
	add(
		new THREE.CylinderGeometry(0.114, 0.114, 0.036, 10),
		RUBY_GLOW,
		0,
		0.153,
		0,
	);
	add(new THREE.ConeGeometry(0.114, 0.09, 10), OBJECT_BRASS, 0, 0.216, 0);
	add(diamond(0.026, 0.075), AMETHYST_GLOW, 0, 0.245, 0);
	add(
		new THREE.CylinderGeometry(0.004, 0.004, 0.17, 5),
		OBJECT_BRASS,
		0,
		0.405,
		0,
	);
	add(ring(0.024, 0.005), OBJECT_BRASS, 0, 0.51, 0);
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
	runeSkull,
	athame,
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
