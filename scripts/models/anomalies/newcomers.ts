import * as THREE from "three";
import {
	MIST_PUFFS,
	MIST_SHELL_COUNT,
	RAT_KNOT_HEIGHT,
	RAT_LAYOUT,
	RAT_SCALE,
} from "../../../src/features/models/anomalies/dimensions";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import type { BuildKit } from "../kit";
import { SOCKET } from "./parts";

const IRON_PLATE: MaterialOptions = {
	texture: "armorPlate",
	color: 0x4e463e,
	roughness: 0.55,
	metalness: 0.6,
};
const CHAIN: MaterialOptions = {
	texture: "iron",
	color: 0x8a7a6a,
	roughness: 0.55,
	metalness: 0.7,
};
const BRASS_BODY: MaterialOptions = {
	texture: "brass",
	color: 0x9a845a,
	roughness: 0.45,
	metalness: 0.75,
};
const COPPER_BODY: MaterialOptions = {
	texture: "copper",
	color: 0x8a7060,
	roughness: 0.45,
	metalness: 0.7,
};
const DARK_IRON: MaterialOptions = {
	color: 0x221c18,
	roughness: 0.6,
	metalness: 0.5,
};

const WEEPER_ROBE: [number, number][] = [
	[0.25, 0],
	[0.24, 0.3],
	[0.2, 0.62],
	[0.16, 0.84],
	[0.19, 1.0],
	[0.2, 1.1],
	[0.12, 1.17],
	[0.001, 1.19],
];

const RAT_PROFILE: [number, number][] = [
	[0.001, -0.02],
	[0.08, 0.02],
	[0.13, 0.1],
	[0.135, 0.18],
	[0.11, 0.26],
	[0.075, 0.31],
	[0.08, 0.35],
	[0.06, 0.41],
	[0.03, 0.46],
	[0.001, 0.49],
];

function chainLinks(kit: BuildKit, name: string, count: number): THREE.Group {
	const chain = kit.pivot(name);
	for (let index = 0; index < count; index += 1) {
		const link = kit.mesh(new THREE.TorusGeometry(0.055, 0.02, 6, 10), CHAIN);
		link.position.y = -index * 0.085;
		link.rotation.y = index % 2 === 0 ? 0 : Math.PI / 2;
		chain.add(link);
	}
	return chain;
}

export function buildColosse(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "colosse";
	const skin: MaterialOptions = { color: 0x4a3e38, roughness: 0.8 };
	const leather: MaterialOptions = { color: 0x261810, roughness: 0.85 };
	const slit = kit.owned("slit", { color: 0xff7a2a, unlit: true });
	const hips = kit.pivot("hips", 0, 1.0, 0);
	root.add(hips);
	hips.add(kit.sphere(0.32, leather, [1.3, 0.7, 1], 14));
	([-1, 1] as const).forEach((side, index) => {
		const hip = kit.pivot(`hip_${index}`, side * 0.24, -0.05, 0);
		hips.add(hip);
		hip.add(kit.limb(0.14, 0.42, leather, 10));
		const knee = kit.pivot(`knee_${index}`, 0, -0.48, 0);
		hip.add(knee);
		knee.add(kit.sphere(0.15, IRON_PLATE, [1, 1, 1], 10));
		knee.add(kit.limb(0.13, 0.36, IRON_PLATE, 10));
		const boot = kit.box(0.28, 0.18, 0.42, IRON_PLATE);
		boot.position.set(0, -0.44, 0.06);
		knee.add(boot);
	});
	const torso = kit.pivot("torso", 0, 0.12, 0);
	hips.add(torso);
	torso.add(
		kit.lathe(
			[
				[0.001, 0],
				[0.36, 0.05],
				[0.47, 0.45],
				[0.55, 0.78],
				[0.36, 0.98],
				[0.001, 1.0],
			],
			IRON_PLATE,
			16,
		),
	);
	const belt = kit.mesh(
		new THREE.TorusGeometry(0.38, 0.055, 6, 22).rotateX(Math.PI / 2),
		leather,
	);
	belt.position.y = 0.09;
	torso.add(belt);
	const collar = kit.mesh(
		new THREE.TorusGeometry(0.28, 0.075, 6, 20).rotateX(Math.PI / 2),
		IRON_PLATE,
	);
	collar.position.y = 0.95;
	torso.add(collar);

	const head = kit.pivot("head", 0, 1.12, 0.1);
	torso.add(head);
	head.add(kit.cylinder(0.17, 0.19, 0.34, IRON_PLATE, 14));
	const dome = kit.sphere(0.17, IRON_PLATE, [1, 0.55, 1], 14);
	dome.position.y = 0.17;
	head.add(dome);
	const slot = kit.box(0.3, 0.075, 0.06, SOCKET);
	slot.position.set(0, 0.03, 0.16);
	head.add(slot);
	const glare = kit.box(0.26, 0.036, 0.04, slit);
	glare.position.set(0, 0.03, 0.172);
	head.add(glare);
	const crest = kit.box(0.06, 0.12, 0.32, IRON_PLATE);
	crest.position.set(0, 0.26, 0);
	head.add(crest);
	head.add(kit.anchor("visor", 0, 0.03, 0.4));

	([-1, 1] as const).forEach((side, index) => {
		const pauldron = kit.sphere(0.24, IRON_PLATE, [1.2, 0.85, 1.1], 12);
		pauldron.position.set(side * 0.56, 0.86, 0);
		torso.add(pauldron);
		for (const lean of [-0.45, 0, 0.45]) {
			const spike = kit.cone(0.05, 0.18, DARK_IRON, 6);
			spike.position.set(side * 0.62, 1.06, lean * 0.3);
			spike.rotation.set(lean * 0.6, 0, -side * 0.45);
			torso.add(spike);
		}
		const shoulder = kit.pivot(`shoulder_${index}`, side * 0.6, 0.78, 0);
		torso.add(shoulder);
		shoulder.add(kit.limb(0.13, 0.5, skin, 10));
		const elbow = kit.pivot(`elbow_${index}`, 0, -0.58, 0);
		shoulder.add(elbow);
		elbow.add(kit.limb(0.13, 0.46, IRON_PLATE, 10));
		const cuff = kit.cylinder(0.165, 0.165, 0.12, CHAIN, 12);
		cuff.position.y = -0.42;
		elbow.add(cuff);
		const fist = kit.sphere(0.18, skin, [1, 1.1, 1], 12);
		fist.position.y = -0.64;
		elbow.add(fist);
		if (side === 1) {
			elbow.add(kit.anchor("knuckles", 0, -0.7, 0));
		}
		const chain = chainLinks(kit, `chain_${index}`, 3);
		chain.position.set(side * 0.1, -0.5, 0.05);
		elbow.add(chain);
	});
	return root;
}

export function buildFulgurant(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "fulgurant";
	const coils = kit.owned("coils", {
		color: 0x3a2014,
		emissive: 0xff3a1a,
		emissiveIntensity: 0,
		roughness: 0.5,
		metalness: 0.4,
	});
	const lens = kit.owned("lens", { color: 0x5a2a20, unlit: true });
	const body = kit.pivot("body", 0, 0.95, 0);
	root.add(body);
	for (let index = 0; index < 3; index += 1) {
		const angle = (index / 3) * Math.PI * 2 + Math.PI / 2;
		const leg = kit.pivot(
			`leg_${index}`,
			Math.cos(angle) * 0.12,
			0,
			Math.sin(angle) * 0.12,
		);
		body.add(leg);
		leg.add(kit.limb(0.055, 0.92, COPPER_BODY, 8));
		leg.rotation.set(-Math.sin(angle) * 0.35, 0, Math.cos(angle) * 0.35);
		const knee = kit.sphere(0.075, BRASS_BODY, [1, 1, 1], 10);
		knee.position.y = -0.45;
		leg.add(knee);
		const foot = kit.cone(0.09, 0.14, DARK_IRON, 6);
		foot.rotation.x = Math.PI;
		foot.position.y = -0.98;
		leg.add(foot);
	}
	body.add(
		kit.lathe(
			[
				[0.001, -0.05],
				[0.26, 0],
				[0.32, 0.25],
				[0.3, 0.5],
				[0.2, 0.62],
				[0.001, 0.64],
			],
			BRASS_BODY,
			16,
		),
	);
	const band = kit.mesh(
		new THREE.TorusGeometry(0.322, 0.03, 6, 24).rotateX(Math.PI / 2),
		COPPER_BODY,
	);
	band.position.y = 0.25;
	body.add(band);
	body.add(kit.anchor("vent", 0, 0.66, 0));
	const horn = kit.pivot("horn", 0, 0.62, 0);
	body.add(horn);
	const neck = kit.cylinder(0.06, 0.08, 0.16, BRASS_BODY, 10);
	neck.position.y = 0.08;
	horn.add(neck);
	const bell = kit.lathe(
		[
			[0.05, 0],
			[0.07, 0.12],
			[0.14, 0.24],
			[0.3, 0.34],
			[0.34, 0.36],
		],
		{ ...BRASS_BODY, side: THREE.DoubleSide },
		18,
	);
	bell.rotation.x = Math.PI / 2 - 0.25;
	bell.position.set(0, 0.17, 0.02);
	horn.add(bell);
	const throat = kit.mesh(new THREE.CircleGeometry(0.075, 12), SOCKET);
	throat.rotation.x = -Math.PI / 2;
	throat.position.y = 0.04;
	bell.add(throat);
	const cannon = kit.pivot("cannon", 0.32, 0.42, 0.02);
	body.add(cannon);
	cannon.add(kit.sphere(0.11, BRASS_BODY, [1, 1, 1], 10));
	const barrel = kit.cylinder(0.065, 0.085, 0.62, COPPER_BODY, 12);
	barrel.rotation.x = Math.PI / 2;
	barrel.position.set(0, 0, 0.32);
	cannon.add(barrel);
	for (let index = 0; index < 4; index += 1) {
		const coil = kit.mesh(new THREE.TorusGeometry(0.095, 0.026, 6, 14), coils);
		coil.position.set(0, 0, 0.12 + index * 0.13);
		cannon.add(coil);
	}
	const tip = kit.cylinder(0.06, 0.05, 0.06, DARK_IRON, 10);
	tip.rotation.x = Math.PI / 2;
	tip.position.set(0, 0, 0.66);
	cannon.add(tip);
	const crystal = kit.sphere(0.045, lens, [1, 1, 1], 10);
	crystal.position.set(0, 0, 0.7);
	cannon.add(crystal);
	cannon.add(kit.anchor("muzzle", 0, 0, 0.74));
	return root;
}

export function buildPleureuse(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "gorgone";
	const stone: MaterialOptions = {
		texture: "stoneSmooth",
		color: 0xa29e94,
		roughness: 0.95,
	};
	const plinthStone: MaterialOptions = {
		texture: "stoneSmooth",
		color: 0x6a665e,
		roughness: 1,
	};
	const face = kit.owned("face", { color: 0x6affd8, unlit: true });
	const plinth = kit.box(0.64, 0.24, 0.64, plinthStone);
	plinth.position.y = 0.12;
	root.add(plinth);
	const slab = kit.box(0.54, 0.07, 0.54, plinthStone);
	slab.position.y = 0.275;
	root.add(slab);

	const statue = kit.pivot("statue", 0, 0.31, 0);
	statue.scale.setScalar(1.12);
	root.add(statue);
	statue.add(
		kit.pleatedLathe(
			WEEPER_ROBE,
			stone,
			9,
			(_radius, height) => 0.07 * Math.max(0, 1 - height / 1.1),
			30,
		),
	);
	const head = kit.pivot("head", 0, 1.27, 0.03);
	statue.add(head);
	head.add(kit.sphere(0.15, stone, [0.9, 1.08, 0.95], 16));
	const nape = kit.sphere(0.13, stone, [1, 1.05, 1], 12);
	nape.position.set(0, -0.02, -0.07);
	head.add(nape);
	const glow = kit.sphere(0.12, face, [0.86, 1.05, 0.42], 14);
	glow.position.set(0, -0.01, 0.1);
	head.add(glow);
	head.add(kit.anchor("chin", 0, -0.14, 0.16), kit.anchor("gaze", 0, 0, 0.5));

	([-1, 1] as const).forEach((side, index) => {
		const shoulder = kit.pivot(`shoulder_${index}`, side * 0.2, 1.1, 0);
		statue.add(shoulder);
		shoulder.add(kit.limb(0.062, 0.3, stone, 10));
		const elbow = kit.pivot(`elbow_${index}`, 0, -0.3, 0);
		shoulder.add(elbow);
		elbow.add(kit.limb(0.055, 0.28, stone, 10));
		const palm = kit.sphere(0.09, stone, [0.72, 1.2, 0.48], 12);
		palm.position.y = -0.32;
		elbow.add(palm);
	});
	return root;
}

export function buildBrume(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "brume";
	const body: MaterialOptions = {
		color: 0x262a32,
		roughness: 1,
		fog: false,
	};
	const inner: MaterialOptions = { ...body, color: 0x343944 };
	const shell: MaterialOptions = {
		color: 0x8a94a6,
		roughness: 1,
		transparent: true,
		opacity: 0.2,
		depthWrite: false,
		fog: false,
	};
	const sight = kit.owned("sight", {
		color: 0xbfe4ff,
		unlit: true,
		fog: false,
	});
	const figure = kit.pivot("figure");
	root.add(figure);
	figure.scale.setScalar(0.66);
	MIST_PUFFS.forEach(([x, y, z, radius], index) => {
		const puff = kit.named(
			`puff_${index}`,
			kit.sphere(radius, index % 2 ? inner : body, [1, 0.92, 1], 12),
		);
		puff.position.set(x, y, z);
		figure.add(puff);
		if (index < MIST_SHELL_COUNT) {
			const halo = kit.named(
				`shell_${index}`,
				kit.sphere(radius * 1.28, shell, [1, 0.95, 1], 12),
			);
			halo.position.set(x, y, z);
			figure.add(halo);
		}
	});
	([-1, 1] as const).forEach((side, index) => {
		const eye = kit.named(
			`eye_${index}`,
			kit.sphere(0.036, sight, [0.62, 1.55, 0.45], 8),
		);
		eye.position.set(side * 0.085, 1.0, 0.26);
		eye.rotation.y = side * 0.25;
		figure.add(eye);
	});
	figure.add(
		kit.anchor("brow", 0, 1.0, 0.45),
		kit.anchor("tail", 0, 0.06, -0.34),
	);
	return root;
}

export function buildRatRoi(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "rat-roi";
	const fur: MaterialOptions = { color: 0x1c1816, roughness: 0.9 };
	const flank: MaterialOptions = { color: 0x2a2320, roughness: 0.85 };
	const tail: MaterialOptions = { color: 0x5a3e3c, roughness: 0.5 };
	const skin: MaterialOptions = { color: 0x3a2a28, roughness: 0.7 };
	const heart = kit.owned("heart", { color: 0xb070ff, unlit: true });
	const knot = kit.pivot("knot", 0, RAT_KNOT_HEIGHT, 0);
	root.add(knot);
	for (const [x, y, z] of [
		[Math.PI / 2, 0, 0],
		[0, Math.PI / 2, 0.6],
		[0.7, 0, Math.PI / 2],
	]) {
		const loop = kit.mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 18), tail);
		loop.rotation.set(x, y, z);
		knot.add(loop);
	}
	knot.add(kit.sphere(0.11, heart, [1, 1, 1], 10));

	RAT_LAYOUT.forEach((_layout, index) => {
		const rat = kit.pivot(`rat_${index}`);
		rat.scale.setScalar(RAT_SCALE * (0.88 + (index % 3) * 0.07));
		const body = kit.lathe(RAT_PROFILE, index % 2 ? flank : fur, 12);
		body.rotation.x = Math.PI / 2;
		body.scale.set(1, 1, 0.8);
		rat.add(body);
		for (const side of [-1, 1]) {
			const ear = kit.sphere(0.042, skin, [1, 1, 0.45], 8);
			ear.position.set(side * 0.05, 0.075, 0.33);
			ear.rotation.z = side * 0.4;
			rat.add(ear);
		}
		rat.add(
			kit.tube(
				[
					[0, 0, 0.02],
					[0.03, -0.05, -0.1],
					[-0.02, -0.13, -0.2],
				],
				(t) => 0.04 - t * 0.02,
				tail,
				8,
				6,
			),
		);
		root.add(rat);
	});
	root.add(kit.anchor("floor", 0, 0.05, 0));
	return root;
}
