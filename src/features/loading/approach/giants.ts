import type { SeededRandom } from "@shared/random";
import * as THREE from "three";
import {
	meterCylinder,
	meterSphere,
	placed,
	scaleUv,
} from "../../world/geometryUtils";
import type { MaterialOptions } from "../../world/MaterialLibrary";
import { type Batch, taperedTube } from "./geometry";
import {
	BLUE_BLOTCH,
	BLUE_CAP,
	CHANTERELLE,
	CREAM_WART,
	GIANT_SKIRT,
	GIANT_STEM,
	GILL_BLADES,
	GILLS,
	LILAC_SPOT,
	MAROON_CAP,
	MOREL_CAP,
	OCHRE_CAP,
	TEAL_BLADES,
	TEAL_CAP,
	TEAL_GILLS,
	VIOLET_BLADES,
	VIOLET_CAP,
	VIOLET_GILLS,
} from "./palette";

export interface GiantStyle {
	cap: MaterialOptions;
	spot: MaterialOptions | null;
	underside: MaterialOptions;
	blades: MaterialOptions;
	skirt: MaterialOptions | null;
	dome: number;
	curl: number;
	wave: number;
	spots: number;
}

export interface MushroomBeds {
	solid: Batch;
	soft: Batch;
}

const UP = new THREE.Vector3(0, 1, 0);

const BLUE_DOME: GiantStyle = {
	cap: BLUE_CAP,
	spot: BLUE_BLOTCH,
	underside: GILLS,
	blades: GILL_BLADES,
	skirt: GIANT_SKIRT,
	dome: 0.55,
	curl: 0.12,
	wave: 0.03,
	spots: 26,
};

const MAROON_RUFFLE: GiantStyle = {
	cap: MAROON_CAP,
	spot: LILAC_SPOT,
	underside: GILLS,
	blades: GILL_BLADES,
	skirt: null,
	dome: 0.32,
	curl: 0.08,
	wave: 0.11,
	spots: 8,
};

const OCHRE_PARASOL: GiantStyle = {
	cap: OCHRE_CAP,
	spot: CREAM_WART,
	underside: GILLS,
	blades: GILL_BLADES,
	skirt: GIANT_SKIRT,
	dome: 0.2,
	curl: 0.05,
	wave: 0.05,
	spots: 30,
};

const TEAL_LANTERN: GiantStyle = {
	cap: TEAL_CAP,
	spot: null,
	underside: TEAL_GILLS,
	blades: TEAL_BLADES,
	skirt: GIANT_SKIRT,
	dome: 0.52,
	curl: 0.12,
	wave: 0.035,
	spots: 0,
};

const VIOLET_LANTERN: GiantStyle = {
	cap: VIOLET_CAP,
	spot: null,
	underside: VIOLET_GILLS,
	blades: VIOLET_BLADES,
	skirt: null,
	dome: 0.42,
	curl: 0.14,
	wave: 0.04,
	spots: 0,
};

const GIANT_STYLES: readonly (readonly [GiantStyle, number])[] = [
	[BLUE_DOME, 2],
	[MAROON_RUFFLE, 2],
	[OCHRE_PARASOL, 1.5],
	[TEAL_LANTERN, 1.5],
	[VIOLET_LANTERN, 1.2],
];

export function pickGiant(rng: SeededRandom): GiantStyle {
	return rng.weighted(GIANT_STYLES);
}

function ruffle(
	geometry: THREE.BufferGeometry,
	radius: number,
	amplitude: number,
	lobes: number,
	phase: number,
): THREE.BufferGeometry {
	const position = geometry.getAttribute("position") as THREE.BufferAttribute;

	for (let index = 0; index < position.count; index += 1) {
		const x = position.getX(index);
		const z = position.getZ(index);
		const reach = Math.min(1, Math.hypot(x, z) / radius);
		const angle = Math.atan2(x, z);

		position.setY(
			index,
			position.getY(index) +
				amplitude * Math.sin(lobes * angle + phase) * reach ** 3,
		);
	}

	return geometry;
}

function profileHeight(
	profile: readonly THREE.Vector2[],
	radius: number,
): number {
	for (let index = 1; index < profile.length; index += 1) {
		const from = profile[index - 1];
		const to = profile[index];

		if (radius <= to.x) {
			return THREE.MathUtils.lerp(
				from.y,
				to.y,
				(radius - from.x) / Math.max(1e-4, to.x - from.x),
			);
		}
	}

	return profile[profile.length - 1].y;
}

function gillBlades(
	count: number,
	profile: readonly THREE.Vector2[],
	inner: number,
	outer: number,
	depth: number,
): THREE.BufferGeometry {
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	const middle = THREE.MathUtils.lerp(inner, outer, 0.4);

	const corners: readonly [number, number][] = [
		[inner, profileHeight(profile, inner)],
		[inner, profileHeight(profile, inner) - depth * 0.75],
		[middle, profileHeight(profile, middle) - depth],
		[outer, profileHeight(profile, outer)],
	];

	for (let blade = 0; blade < count; blade += 1) {
		const angle = (blade / count) * Math.PI * 2;
		const sin = Math.sin(angle);
		const cos = Math.cos(angle);
		const first = positions.length / 3;

		for (const [reach, height] of corners) {
			positions.push(sin * reach, height, cos * reach);
			normals.push(cos, 0, -sin);
			uvs.push(reach, height);
		}

		indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
	}

	const geometry = new THREE.BufferGeometry();

	geometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(positions, 3),
	);

	geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
	geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
	geometry.setIndex(indices);

	return geometry;
}

export function giantMushroom(
	beds: MushroomBeds,
	rng: SeededRandom,
	style: GiantStyle,
	x: number,
	z: number,
	height: number,
	radius: number,
	coarse: boolean,
): void {
	const fine = radius > 1.2 && !coarse;
	const segments = coarse ? 12 : fine ? 28 : 16;
	const sides = coarse ? 6 : fine ? 12 : 8;
	const rows = coarse ? 6 : 10;
	const stemRadius = radius * rng.range(0.13, 0.17);
	const capHeight = radius * style.dome;
	const curl = radius * style.curl;
	const amplitude = radius * style.wave;
	const lobes = rng.int(5, 9);
	const phase = rng.range(0, Math.PI * 2);
	const swayAngle = rng.range(0, Math.PI * 2);
	const sway = new THREE.Vector3(Math.cos(swayAngle), 0, Math.sin(swayAngle));
	const lean = rng.range(0.03, 0.18);

	const points = Array.from({ length: 7 }, (_, index) => {
		const t = index / 6;

		return new THREE.Vector3(x, -0.2 + (height + 0.2) * t, z).addScaledVector(
			sway,
			height * (lean * t ** 1.6 + 0.04 * Math.sin(t * Math.PI)),
		);
	});

	const radii = points.map((_, index) =>
		index === 0
			? stemRadius * 1.7
			: index === 1
				? stemRadius * 1.15
				: THREE.MathUtils.lerp(1.05, 0.82, index / 6) * stemRadius,
	);

	beds.solid.add(GIANT_STEM, taperedTube(points, radii, sides));

	beds.solid.add(
		GIANT_STEM,
		placed(
			meterSphere(stemRadius * 1.75, sides, coarse ? 4 : 6).scale(1, 0.55, 1),
			x,
			stemRadius * 0.3,
			z,
		),
	);

	if (style.skirt) {
		const ring = points[4];

		beds.soft.add(
			style.skirt,
			placed(
				meterCylinder(
					radii[4] * 1.02,
					radii[4] * 1.9,
					height * 0.07,
					coarse ? 8 : 14,
					true,
				),
				ring.x,
				ring.y - height * 0.035,
				ring.z,
			),
		);
	}

	const top = points[points.length - 1];

	const tilt = new THREE.Quaternion().setFromUnitVectors(
		UP,
		top
			.clone()
			.sub(points[points.length - 2])
			.normalize()
			.lerp(UP, 0.4)
			.normalize(),
	);

	const frame = new THREE.Matrix4().compose(
		top,
		tilt,
		new THREE.Vector3(1, 1, 1),
	);

	const crown = Array.from({ length: rows + 1 }, (_, index) => {
		const angle = (index / rows) * (Math.PI / 2);

		return new THREE.Vector2(
			Math.max(0.001, radius * Math.cos(angle)),
			capHeight * Math.sin(angle) - curl * (1 - Math.sin(angle)) ** 2,
		);
	});

	const underside = [
		new THREE.Vector2(stemRadius * 0.95, capHeight * 0.18),
		new THREE.Vector2(radius * 0.45, capHeight * 0.1 - curl * 0.1),
		new THREE.Vector2(radius * 0.8, -curl * 0.45),
		new THREE.Vector2(radius, -curl),
	];

	const blades = Math.round(
		coarse
			? THREE.MathUtils.clamp(radius * 6, 8, 24)
			: THREE.MathUtils.clamp(radius * 12, 12, 56),
	);

	const capGeometry = new THREE.LatheGeometry(crown, segments);
	const gillGeometry = new THREE.LatheGeometry(underside, segments);

	scaleUv(capGeometry, Math.PI * 2 * radius, radius + capHeight);
	scaleUv(gillGeometry, blades / 16, 1);

	const parts: readonly [MaterialOptions, Batch, THREE.BufferGeometry][] = [
		[style.cap, beds.solid, capGeometry],
		[style.underside, beds.soft, gillGeometry],
		[
			style.blades,
			beds.soft,
			gillBlades(
				blades,
				underside,
				stemRadius * 1.2,
				radius * 0.96,
				radius * 0.09,
			),
		],
	];

	for (const [material, batch, geometry] of parts) {
		batch.add(
			material,
			ruffle(geometry, radius, amplitude, lobes, phase).applyMatrix4(frame),
		);
	}

	if (!style.spot) {
		return;
	}

	const spots = Math.round(style.spots * Math.min(1, radius / 2));

	for (let index = 0; index < spots; index += 1) {
		const angle = rng.range(0.12, 1.25);
		const around = rng.range(0, Math.PI * 2);
		const reach = radius * Math.cos(angle);
		const size = radius * rng.range(0.05, 0.12);
		const stretchX = rng.range(0.8, 1.3);
		const stretchZ = rng.range(0.8, 1.3);
		const turn = rng.range(0, Math.PI);

		if (coarse && index % 2 === 1) {
			continue;
		}

		const normal = new THREE.Vector3(
			Math.sin(around) * capHeight * Math.cos(angle),
			radius * Math.sin(angle),
			Math.cos(around) * capHeight * Math.cos(angle),
		).normalize();

		const spot = new THREE.Vector3(
			Math.sin(around) * reach,
			capHeight * Math.sin(angle) - curl * (1 - Math.sin(angle)) ** 2,
			Math.cos(around) * reach,
		);

		spot.y +=
			amplitude * Math.sin(lobes * around + phase) * (reach / radius) ** 3;

		beds.solid.add(
			style.spot,
			meterSphere(size, coarse ? 5 : 6, coarse ? 3 : 4)
				.scale(stretchX, 0.24, stretchZ)
				.rotateY(turn)
				.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, normal))
				.translate(spot.x, spot.y, spot.z)
				.applyMatrix4(frame),
		);
	}
}

export function chanterelles(
	batch: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
	coarse: boolean,
): void {
	for (let index = rng.int(3, 6); index > 0; index -= 1) {
		const size = rng.range(0.12, 0.32);
		const angle = rng.range(0, Math.PI * 2);
		const reach = rng.range(0, 0.6);

		const profile = [
			new THREE.Vector2(size * 0.12, 0),
			new THREE.Vector2(size * 0.14, size * 0.35),
			new THREE.Vector2(size * 0.25, size * 0.7),
			new THREE.Vector2(size * 0.55, size * 0.95),
			new THREE.Vector2(size, size * 1.05),
			new THREE.Vector2(size * 0.8, size * 1.08),
			new THREE.Vector2(size * 0.35, size * 0.98),
			new THREE.Vector2(0.001, size * 0.9),
		];

		const funnel = ruffle(
			scaleUv(
				new THREE.LatheGeometry(profile, coarse ? 9 : 14),
				Math.PI * size,
				size,
			),
			size,
			size * 0.09,
			rng.int(4, 6),
			rng.range(0, Math.PI * 2),
		);

		batch.add(
			CHANTERELLE,
			placed(
				funnel,
				x + Math.cos(angle) * reach,
				-0.02,
				z + Math.sin(angle) * reach,
				rng.range(0, Math.PI),
				rng.range(-0.15, 0.15),
				rng.range(-0.15, 0.15),
			),
		);
	}
}

export function morels(
	batch: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
	coarse: boolean,
): void {
	for (let index = rng.int(2, 4); index > 0; index -= 1) {
		const size = rng.range(0.18, 0.4);
		const angle = rng.range(0, Math.PI * 2);
		const reach = rng.range(0, 0.5);
		const px = x + Math.cos(angle) * reach;
		const pz = z + Math.sin(angle) * reach;

		const profile = Array.from({ length: 14 }, (_, step) => {
			const t = step / 13;

			return new THREE.Vector2(
				Math.max(0.001, size * 0.3 * (1 - t ** 1.8) ** 0.6),
				size * (0.45 + 0.8 * t),
			);
		});

		const cap = new THREE.LatheGeometry(profile, coarse ? 10 : 18);
		const position = cap.getAttribute("position") as THREE.BufferAttribute;

		for (let vertex = 0; vertex < position.count; vertex += 1) {
			const vx = position.getX(vertex);
			const vy = position.getY(vertex);
			const vz = position.getZ(vertex);
			const around = Math.atan2(vx, vz);
			const row = vy / size;

			const pit =
				Math.sin(around * 6 + Math.floor(row * 9) * 1.7) * Math.sin(row * 28);

			const squeeze = pit > 0.25 ? 0.82 : 1;

			position.setXYZ(vertex, vx * squeeze, vy, vz * squeeze);
		}

		cap.computeVertexNormals();

		batch.add(
			GIANT_STEM,
			placed(
				meterCylinder(size * 0.17, size * 0.22, size * 0.55, 8),
				px,
				size * 0.25,
				pz,
			),
		);

		batch.add(
			MOREL_CAP,
			placed(scaleUv(cap, Math.PI * size * 0.6, size), px, 0, pz),
		);
	}
}

export function giantCluster(
	beds: MushroomBeds,
	rng: SeededRandom,
	x: number,
	z: number,
	height: number,
	radius: number,
	keepClear: (x: number, z: number) => boolean,
	coarse: boolean,
): void {
	const style = pickGiant(rng);

	giantMushroom(beds, rng, style, x, z, height, radius, coarse);

	for (let index = rng.int(2, 5); index > 0; index -= 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = radius * rng.range(0.45, 1.1);
		const sx = x + Math.cos(angle) * reach;
		const sz = z + Math.sin(angle) * reach;
		const size = height * rng.range(0.1, 0.32);

		if (!keepClear(sx, sz)) {
			giantMushroom(
				beds,
				rng,
				rng.chance(0.7) ? style : pickGiant(rng),
				sx,
				sz,
				size,
				size * rng.range(0.38, 0.55),
				coarse,
			);
		}
	}

	const side = rng.range(0, Math.PI * 2);
	const fx = x + Math.cos(side) * radius * 0.6;
	const fz = z + Math.sin(side) * radius * 0.6;

	if (rng.chance(0.55) && !keepClear(fx, fz)) {
		chanterelles(beds.soft, rng, fx, fz, coarse);
	}

	const mx = x - Math.cos(side) * radius * 0.5;
	const mz = z - Math.sin(side) * radius * 0.5;

	if (rng.chance(0.45) && !keepClear(mx, mz)) {
		morels(beds.soft, rng, mx, mz, coarse);
	}
}
