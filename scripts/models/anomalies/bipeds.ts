import * as THREE from "three";
import {
	COLLECTEUR_HIPS,
	REVERBERE_BEAMS,
	REVERBERE_HIP,
	ROD_HEIGHT,
} from "../../../src/features/models/anomalies/dimensions";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import type { BuildKit } from "../kit";
import { claws, hoodGeometry, normalizeHeightUv, SOCKET } from "./parts";

const BRASS: MaterialOptions = {
	texture: "brass",
	color: 0x8a7a5c,
	roughness: 0.45,
	metalness: 0.75,
};

const BONE: MaterialOptions = { color: 0xbfb08e, roughness: 0.5 };

const REVERBERE_THIGH = 0.52;
const REVERBERE_SHIN = 0.6;

const REVERBERE_TORSO: [number, number][] = [
	[0.001, 0],
	[0.17, 0.04],
	[0.2, 0.18],
	[0.26, 0.38],
	[0.26, 0.5],
	[0.15, 0.62],
	[0.001, 0.64],
];

const REVERBERE_SHADE: [number, number][] = [
	[0.001, -0.2],
	[0.09, -0.19],
	[0.16, -0.13],
	[0.21, -0.02],
	[0.24, 0.08],
	[0.27, 0.13],
];

const COLLECTEUR_COAT: [number, number][] = [
	[0.001, 0.84],
	[0.11, 0.82],
	[0.2, 0.74],
	[0.215, 0.5],
	[0.23, 0.15],
	[0.265, -0.15],
	[0.31, -0.42],
];

const SACK_PROFILE: [number, number][] = [
	[0.001, 0],
	[0.18, 0.03],
	[0.32, 0.18],
	[0.36, 0.4],
	[0.3, 0.6],
	[0.14, 0.74],
	[0.075, 0.8],
	[0.11, 0.9],
	[0.001, 0.88],
];

const MURMURE_CLOAK: [number, number][] = [
	[0.41, 0.02],
	[0.36, 0.35],
	[0.3, 0.8],
	[0.255, 1.15],
	[0.24, 1.35],
	[0.17, 1.42],
	[0.001, 1.44],
];

function hand(
	kit: BuildKit,
	skin: MaterialOptions,
	nails: MaterialOptions,
	side: number,
	length: number,
): THREE.Group {
	const wrist = new THREE.Group();

	wrist.add(kit.sphere(length * 0.24, skin, [1, 1.1, 0.7], 10));

	const fingers = claws(kit, nails, 3, length, length * 0.11, 0.32, 0.45);

	fingers.position.y = -length * 0.12;

	wrist.add(fingers);

	wrist.rotation.y = (-side * Math.PI) / 2;

	return wrist;
}

function beamCone(
	kit: BuildKit,
	name: string,
	radius: number,
	length: number,
	opacity: number,
): THREE.Mesh {
	const geometry = new THREE.ConeGeometry(radius, length, 24, 1, true)
		.translate(0, -length / 2, 0)
		.rotateX(-Math.PI / 2);

	const mesh = kit.named(
		name,
		kit.mesh(geometry, {
			color: 0xffffff,
			unlit: true,
			transparent: true,
			opacity,
			depthWrite: false,
			side: THREE.DoubleSide,
		}),
	);

	mesh.renderOrder = 2;

	return mesh;
}

export function buildReverbere(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();

	root.name = "veilleur";

	const soot: MaterialOptions = { color: 0x1d1917, roughness: 0.75 };

	const iron: MaterialOptions = {
		color: 0x15110f,
		roughness: 0.5,
		metalness: 0.55,
	};

	const shade: MaterialOptions = { ...iron, side: THREE.DoubleSide };
	const pelvis = kit.pivot("pelvis", 0, REVERBERE_HIP, 0);

	root.add(pelvis);
	pelvis.add(kit.sphere(0.19, soot, [1.15, 0.75, 0.95], 12));

	const torso = kit.pivot("torso", 0, 0.05, 0);

	pelvis.add(torso);

	const chest = kit.lathe(REVERBERE_TORSO, soot, 14);

	chest.scale.z = 0.82;

	torso.add(chest);

	const neck = kit.pivot("neck", 0, 0.6, 0.02);

	torso.add(neck);

	neck.add(
		kit.tube(
			[
				[0, -0.06, 0],
				[0, 0.26, -0.02],
				[0, 0.5, 0.12],
				[0, 0.55, 0.35],
				[0, 0.44, 0.5],
			],
			(t) => 0.085 - t * 0.025,
			iron,
			20,
			8,
		),
	);

	const lamp = kit.pivot("lamp", 0, 0.41, 0.53);

	neck.add(lamp);

	const hood = kit.lathe(REVERBERE_SHADE, shade, 18);

	hood.rotation.x = Math.PI / 2;

	lamp.add(hood);

	const bulb = kit.sphere(
		0.11,
		kit.owned("flame", { color: 0xd0d0d0, unlit: true }),
		[1, 1, 0.8],
		12,
	);

	bulb.position.z = 0.02;

	lamp.add(bulb);

	REVERBERE_BEAMS.forEach(([radius, length, opacity], index) => {
		const beam = beamCone(kit, `beam_${index}`, radius, length, opacity);

		beam.position.z = 0.04;

		lamp.add(beam);
	});

	lamp.add(kit.anchor("beam_end", 0, 0, 2.2), kit.anchor("wick", 0, 0, 0.16));

	([-1, 1] as const).forEach((side, index) => {
		const hip = kit.pivot(`hip_${index}`, side * 0.15, -0.02, 0);

		pelvis.add(hip);
		hip.add(kit.limb(0.09, REVERBERE_THIGH, soot, 10));

		const knee = kit.pivot(`knee_${index}`, 0, -REVERBERE_THIGH, 0);

		hip.add(knee);
		knee.add(kit.limb(0.07, REVERBERE_SHIN, soot, 10));

		const ankle = kit.pivot(`ankle_${index}`, 0, -REVERBERE_SHIN, 0);

		knee.add(ankle);

		const foot = kit.sphere(0.09, iron, [0.9, 0.45, 2.1], 10);

		foot.position.set(0, -0.02, 0.1);
		ankle.add(foot);

		const shoulder = kit.pivot(`shoulder_${index}`, side * 0.25, 0.5, 0.02);

		torso.add(shoulder);
		shoulder.add(kit.limb(0.085, 0.56, soot, 10));

		const elbow = kit.pivot(`elbow_${index}`, 0, -0.56, 0);

		shoulder.add(elbow);
		elbow.add(kit.limb(0.07, 0.52, soot, 10));

		const fist = kit.sphere(0.105, iron, [0.75, 1.45, 0.62], 10);

		fist.position.y = -0.62;

		elbow.add(fist);
	});

	return root;
}

export function buildCollecteur(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();

	root.name = "collecteur";

	const coat: MaterialOptions = {
		color: 0x17111a,
		roughness: 0.95,
		side: THREE.DoubleSide,
	};

	const skin: MaterialOptions = { color: 0x3a3430, roughness: 0.75 };
	const scaly: MaterialOptions = { color: 0x241c18, roughness: 0.6 };
	const skull: MaterialOptions = { color: 0xcfc4ac, roughness: 0.55 };
	const felt: MaterialOptions = { color: 0x0e0b0c, roughness: 0.85 };

	const burlap: MaterialOptions = {
		texture: "burlap",
		color: 0x9a8466,
		roughness: 1,
	};

	const embers = kit.owned("embers", { color: 0xffd040, unlit: true });

	const hips = kit.pivot("hips", 0, COLLECTEUR_HIPS, 0);

	root.add(hips);

	([-1, 1] as const).forEach((side, index) => {
		const hip = kit.pivot(`hip_${index}`, side * 0.1, 0, 0);

		hips.add(hip);
		hip.add(kit.limb(0.065, 0.3, coat, 8));

		const knee = kit.pivot(`knee_${index}`, 0, -0.3, 0);

		hip.add(knee);
		knee.add(kit.sphere(0.056, scaly, [1, 1, 1], 8));
		knee.add(kit.limb(0.042, 0.5, scaly, 8));

		const ankle = kit.pivot(`ankle_${index}`, 0, -0.5, 0);

		knee.add(ankle);
		ankle.add(kit.sphere(0.046, scaly, [1, 1, 1], 8));
		ankle.add(kit.limb(0.035, 0.5, scaly, 8));

		const foot = kit.pivot(`foot_${index}`, 0, -0.5, 0);

		ankle.add(foot);
		foot.add(kit.sphere(0.048, scaly, [1, 0.7, 1], 8));

		for (const angle of [-0.5, 0, 0.5, Math.PI]) {
			const length = angle === Math.PI ? 0.1 : 0.18;

			const toe = kit.mesh(
				new THREE.ConeGeometry(0.028, length, 6).translate(0, length / 2, 0),
				scaly,
			);

			toe.rotation.set(Math.PI / 2 - 0.12, 0, angle);

			toe.position.y = -0.02;

			foot.add(toe);
		}
	});

	const torso = kit.pivot("torso", 0, 0.02, 0);

	hips.add(torso);

	torso.add(
		kit.pleatedLathe(
			COLLECTEUR_COAT,
			coat,
			8,
			(_radius, height) => Math.max(0, 0.2 - height) * 0.16,
			24,
		),
	);

	const collar = kit.cylinder(0.095, 0.13, 0.12, coat, 14);

	collar.position.y = 0.84;

	torso.add(collar);

	const sack = kit.named(
		"sack",
		kit.pleatedLathe(
			SACK_PROFILE,
			burlap,
			7,
			(_radius, height) => (height > 0.6 ? (height - 0.6) * 0.5 : 0.03),
			18,
		),
	);

	sack.position.set(0, -0.05, -0.36);

	sack.rotation.x = -0.25;

	torso.add(sack);

	const tie = kit.mesh(new THREE.TorusGeometry(0.085, 0.024, 6, 12), {
		...burlap,
		color: 0x5a4a38,
	});

	tie.rotation.x = Math.PI / 2;
	tie.position.y = 0.8;

	sack.add(tie);

	const stain = kit.sphere(
		0.2,
		{ color: 0x2a0c0a, roughness: 0.9 },
		[1.25, 0.35, 1.25],
	);

	stain.position.y = 0.06;

	sack.add(stain);

	const neck = kit.pivot("neck", 0, 0.82, 0.04);

	torso.add(neck);

	neck.add(
		kit.tube(
			[
				[0, -0.04, 0],
				[0, 0.1, 0.06],
				[0, 0.2, 0.18],
			],
			(t) => 0.045 - t * 0.008,
			skin,
			8,
			7,
		),
	);

	const head = kit.pivot("head", 0, 0.24, 0.22);

	neck.add(head);
	head.add(kit.sphere(0.1, skull, [0.8, 0.95, 1.15], 14));

	head.add(
		kit.tube(
			[
				[0, -0.02, 0.07],
				[0, -0.045, 0.24],
				[0, -0.13, 0.36],
			],
			(t) => 0.048 * (1 - t) + 0.005,
			skull,
			10,
			8,
		),
	);

	for (const side of [-1, 1]) {
		const eye = kit.sphere(0.038, embers, [1, 0.9, 0.5], 10);

		eye.position.set(side * 0.05, 0.035, 0.075);

		eye.rotation.y = side * 0.5;

		head.add(eye);
	}

	head.add(kit.anchor("gaze", 0, 0.03, 0.26));

	const hat = kit.pivot("hat", 0, 0.085, -0.01);

	hat.rotation.x = -0.12;

	head.add(hat);
	hat.add(kit.cylinder(0.19, 0.19, 0.026, felt, 18));

	const crown = kit.cylinder(0.1, 0.112, 0.34, felt, 14);

	crown.position.y = 0.18;

	hat.add(crown);

	const band = kit.cylinder(0.115, 0.115, 0.065, { color: 0x4a0c0c }, 14);

	band.position.y = 0.05;

	hat.add(band);

	([-1, 1] as const).forEach((side, index) => {
		const shoulder = kit.pivot(`shoulder_${index}`, side * 0.21, 0.72, 0.02);

		torso.add(shoulder);
		shoulder.add(kit.sphere(0.068, coat, [1, 1, 1], 10));
		shoulder.add(kit.limb(0.05, 0.5, coat, 8));

		const elbow = kit.pivot(`elbow_${index}`, 0, -0.5, 0);

		shoulder.add(elbow);
		elbow.add(kit.limb(0.042, 0.44, coat, 8));

		const fist = hand(kit, skin, BONE, side, 0.28);

		fist.position.y = -0.47;

		elbow.add(fist);
	});

	return root;
}

export function buildMurmure(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();

	root.name = "murmure";

	const cloth: MaterialOptions = {
		texture: "curtainPale",
		color: 0xa89e8c,
		roughness: 1,
		side: THREE.DoubleSide,
		fixedRepeat: true,
	};

	const dark: MaterialOptions = { color: 0x120d0e, roughness: 0.9 };
	const body = kit.pivot("body", 0, 0, 0);

	root.add(body);

	const cloak = kit.named(
		"cloak",
		kit.pleatedLathe(
			MURMURE_CLOAK,
			cloth,
			7,
			(_radius, height) => 0.04 + Math.max(0, 1.2 - height) * 0.08,
			28,
		),
	);

	normalizeHeightUv(cloak);
	body.add(cloak);

	const rod = kit.cylinder(0.032, 0.032, 0.8, BRASS, 10);

	rod.rotation.z = Math.PI / 2;

	rod.position.set(0, ROD_HEIGHT, -0.02);
	body.add(rod);

	for (const side of [-1, 1]) {
		const finial = kit.cone(0.06, 0.16, BRASS, 8);

		finial.rotation.z = (-side * Math.PI) / 2;

		finial.position.set(side * 0.47, ROD_HEIGHT, -0.02);
		body.add(finial);

		const ring = kit.mesh(new THREE.TorusGeometry(0.06, 0.017, 6, 14), BRASS);

		ring.rotation.y = Math.PI / 2;

		ring.position.set(side * 0.31, ROD_HEIGHT - 0.02, -0.02);
		body.add(ring);
	}

	body.add(kit.anchor("dust", 0, ROD_HEIGHT, 0.1));

	const head = kit.pivot("head", 0, 1.52, 0.06);

	body.add(head);

	const hood = kit.mesh(hoodGeometry(0.2, 0.95), cloth);

	hood.scale.set(0.88, 1.1, 1);

	hood.rotation.x = 0.12;

	head.add(hood);

	const tip = kit.cone(0.08, 0.24, cloth, 10);

	tip.position.set(0, 0.16, -0.1);

	tip.rotation.x = -1.1;

	head.add(tip);

	const hollow = kit.sphere(0.18, SOCKET, [0.9, 1.05, 0.85], 14);

	hollow.position.z = -0.045;

	head.add(hollow);

	const mask = kit.sphere(0.12, cloth, [0.84, 1.3, 0.55], 14);

	mask.position.set(0, -0.035, 0.07);
	head.add(mask);

	for (const side of [-1, 1]) {
		const socket = kit.sphere(0.036, SOCKET, [0.75, 1.4, 0.55], 10);

		socket.position.set(side * 0.044, 0.012, 0.12);

		socket.rotation.y = side * 0.25;

		head.add(socket);
	}

	head.add(kit.anchor("face", 0, 0, 0.3));

	([-1, 1] as const).forEach((side, index) => {
		const shoulder = kit.pivot(
			`shoulder_${index}`,
			side * 0.35,
			ROD_HEIGHT - 0.03,
			0,
		);

		body.add(shoulder);

		shoulder.add(
			kit.tube(
				[
					[0, 0.03, 0],
					[0, -0.2, 0.01],
					[0, -0.42, 0.02],
				],
				(t) => 0.045 + t * 0.03,
				cloth,
				8,
				10,
			),
		);

		const elbow = kit.pivot(`elbow_${index}`, 0, -0.4, 0.02);

		shoulder.add(elbow);

		elbow.add(
			kit.tube(
				[
					[0, 0.02, 0],
					[0, -0.26, 0.02],
					[0, -0.54, 0.07],
				],
				(t) => 0.032 * (1 - t) + 0.005,
				dark,
				8,
				6,
			),
		);
	});

	return root;
}
