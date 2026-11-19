import * as THREE from "three";
import {
	ARCHIVIST_BOOKS,
	ARCHIVIST_PAGES,
	BRAZIER_HEIGHT,
	BRAZIER_KNEE,
	BRAZIER_LIFT,
	SAC_SCALE,
} from "../../../src/features/models/anomalies/dimensions";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import type { BuildKit } from "../kit";
import { hoodGeometry, SOCKET, wobbleSphere } from "./parts";

const TEETH: MaterialOptions = { color: 0xd2c4a2, roughness: 0.4 };
const IRON: MaterialOptions = {
	texture: "iron",
	color: 0x5a524c,
	roughness: 0.6,
	metalness: 0.5,
};
const ARCHIVIST_ROBE: [number, number][] = [
	[0.001, 0.0],
	[0.35, 0.05],
	[0.28, 0.5],
	[0.22, 1.0],
	[0.18, 1.3],
	[0.001, 1.35],
];
const ARCHIVIST_ROBE_BASE = 0.55;
const BRAZIER_BOWL: [number, number][] = [
	[0.001, -0.3],
	[0.14, -0.28],
	[0.28, -0.19],
	[0.37, -0.05],
	[0.41, 0.07],
	[0.37, 0.1],
];
const BRAZIER_THIGH = 0.6;
const BRAZIER_SHIN = 1.41;
const WISP_BELL: [number, number][] = [
	[0.001, 0.17],
	[0.1, 0.15],
	[0.17, 0.08],
	[0.2, -0.02],
	[0.19, -0.08],
	[0.21, -0.12],
];

export function buildBrasier(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "crache-cendre";
	const charcoal: MaterialOptions = { color: 0x1a1412, roughness: 0.9 };
	const fire = kit.owned("fire", { color: 0xff7a2a, unlit: true });
	const body = kit.pivot("body", 0, BRAZIER_HEIGHT, 0);
	root.add(body);
	body.add(kit.lathe(BRAZIER_BOWL, { ...IRON, side: THREE.DoubleSide }, 20));
	const rim = kit.mesh(
		new THREE.TorusGeometry(0.395, 0.035, 6, 24).rotateX(Math.PI / 2),
		IRON,
	);
	rim.position.y = 0.085;
	body.add(rim);
	const bed = kit.sphere(0.36, fire, [1, 0.32, 1], 18);
	bed.position.y = 0.05;
	body.add(bed);
	for (const [x, z, size] of [
		[-0.12, 0.06, 0.11],
		[0.14, -0.1, 0.09],
		[0.03, 0.17, 0.08],
	]) {
		const lump = kit.sphere(size, charcoal, [1, 0.7, 1], 8);
		lump.position.set(x, 0.12, z);
		body.add(lump);
	}
	[
		[0, 0, 0.12, 0.42],
		[-0.16, 0.08, 0.09, 0.3],
		[0.15, 0.1, 0.085, 0.28],
		[0.02, -0.17, 0.09, 0.32],
	].forEach(([x, z, radius, height], index) => {
		const flame = kit.named(
			`flame_${index}`,
			kit.mesh(
				new THREE.ConeGeometry(radius, height, 8).translate(0, height / 2, 0),
				fire,
			),
		);
		flame.position.set(x, 0.1, z);
		body.add(flame);
	});
	body.add(kit.anchor("coals", 0, 0.22, 0));
	for (let index = 0; index < 6; index += 1) {
		const angle = (index / 6) * Math.PI * 2;
		const hip = kit.pivot(
			`hip_${index}`,
			Math.cos(angle) * 0.3,
			-0.06,
			Math.sin(angle) * 0.3,
		);
		hip.rotation.y = -angle;
		body.add(hip);
		const thigh = kit.pivot(`thigh_${index}`, 0, 0, 0);
		thigh.rotation.z = BRAZIER_LIFT;
		hip.add(thigh);
		thigh.add(kit.limb(0.045, BRAZIER_THIGH, IRON, 8));
		const knee = kit.pivot(`knee_${index}`, 0, -BRAZIER_THIGH, 0);
		knee.rotation.z = BRAZIER_KNEE;
		thigh.add(knee);
		knee.add(kit.sphere(0.062, IRON, [1, 1, 1], 8));
		knee.add(kit.limb(0.035, BRAZIER_SHIN, IRON, 8));
		const tip = kit.cone(0.036, 0.14, IRON, 6);
		tip.rotation.x = Math.PI;
		tip.position.y = -BRAZIER_SHIN - 0.07;
		knee.add(tip);
	}
	return root;
}

export function buildSuinteur(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "suinteur";
	const slime: MaterialOptions = {
		color: 0x3e5a2a,
		emissive: 0x10300a,
		emissiveIntensity: 1,
		roughness: 0.12,
		transparent: true,
		opacity: 0.86,
	};
	const bone: MaterialOptions = { color: 0xc8bca0, roughness: 0.6 };
	const skull = kit.pivot("skull");
	skull.position.set(0.08, 0.42, 0.02);
	skull.rotation.set(0.3, -0.5, 0.4);
	root.add(skull);
	skull.add(kit.sphere(0.12, bone, [1, 0.95, 1.1], 12));
	const jaw = kit.box(0.14, 0.06, 0.1, bone);
	jaw.position.set(0, -0.1, 0.05);
	skull.add(jaw);
	for (const side of [-1, 1]) {
		const hole = kit.sphere(0.04, SOCKET, [1, 1, 0.6], 8);
		hole.position.set(side * 0.045, 0.01, 0.11);
		skull.add(hole);
	}
	const blob = kit.named("blob", wobbleSphere(kit, 0.6, slime, 24));
	blob.position.y = 0.48;
	root.add(blob);
	const puddle = kit.named("puddle", kit.sphere(0.88, slime, [1, 0.07, 1], 20));
	puddle.position.y = 0.03;
	root.add(puddle);
	return root;
}

function surfacePoint(theta: number, phi: number): THREE.Vector3 {
	return new THREE.Vector3(
		Math.sin(phi) * Math.sin(theta),
		Math.cos(phi),
		Math.sin(phi) * Math.cos(theta),
	);
}

export function buildBoursoufle(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "boursoufle";
	const flesh: MaterialOptions = { color: 0x8a706e, roughness: 0.42 };
	const bruise: MaterialOptions = { color: 0x3a1a2a, roughness: 0.6 };
	const pores = kit.owned("pores", { color: 0xff9a40, unlit: true });
	const figure = kit.pivot("figure");
	figure.scale.setScalar(SAC_SCALE);
	root.add(figure);
	const sac = kit.named("sac", wobbleSphere(kit, 0.6, flesh, 24));
	sac.position.y = 1.05;
	figure.add(sac);
	sac.add(kit.anchor("crown", 0, 0.6, 0));
	for (const [x, y, z, size] of [
		[-0.4, 0.18, 0.06, 0.25],
		[0.18, -0.22, -0.42, 0.24],
		[0.24, 0.46, -0.22, 0.14],
	]) {
		const tumor = kit.sphere(size, flesh, [1, 0.9, 1], 14);
		tumor.position.set(x, y, z);
		sac.add(tumor);
	}
	for (const [theta, phi, size] of [
		[1.7, 1.2, 0.2],
		[-2.4, 1.0, 0.24],
		[2.6, 1.9, 0.18],
		[-1.5, 1.8, 0.16],
		[3.1, 0.7, 0.15],
	]) {
		const patch = kit.sphere(size, bruise, [1, 1, 0.12], 10);
		const direction = surfacePoint(theta, phi);
		patch.position.copy(direction).multiplyScalar(0.585);
		patch.lookAt(direction.clone().multiplyScalar(2));
		sac.add(patch);
	}
	for (const [theta, phi, size] of [
		[0.95, 0.7, 0.09],
		[-1.1, 0.8, 0.08],
		[2.4, 1.2, 0.1],
		[-2.2, 0.6, 0.085],
		[3.1, 1.9, 0.07],
		[1.6, 2.1, 0.08],
		[-1.7, 2.0, 0.075],
	]) {
		const pore = kit.sphere(size, pores, [1, 1, 0.6], 8);
		const direction = surfacePoint(theta, phi);
		pore.position.copy(direction).multiplyScalar(0.585);
		pore.lookAt(direction.clone().multiplyScalar(2));
		sac.add(pore);
	}
	([-1, 1] as const).forEach((side, index) => {
		const leg = kit.pivot(`leg_${index}`, side * 0.17, 0.64, 0);
		figure.add(leg);
		leg.add(kit.limb(0.04, 0.34, flesh, 8));
		const knee = kit.pivot(`knee_${index}`, 0, -0.34, 0);
		leg.add(knee);
		knee.add(kit.sphere(0.05, flesh, [1, 1, 1], 8));
		knee.add(kit.limb(0.034, 0.3, flesh, 8));
		const foot = kit.sphere(0.05, flesh, [1, 0.5, 1.7], 8);
		foot.position.set(0, -0.32, 0.04);
		knee.add(foot);
		const arm = kit.pivot(`arm_${index}`, side * 0.5, 1.12, 0.12);
		figure.add(arm);
		arm.add(kit.limb(0.034, 0.26, flesh, 8));
	});
	return root;
}

export function buildFeuFollet(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "luciole";
	const heart = kit.owned("heart", { color: 0xe8ff9a, unlit: true });
	const glass: MaterialOptions = {
		color: 0xb8ff8a,
		unlit: true,
		transparent: true,
		opacity: 0.26,
		side: THREE.DoubleSide,
		depthWrite: false,
	};
	const veil: MaterialOptions = { ...glass, color: 0xd8ff9a, opacity: 0.2 };
	const body = kit.pivot("body");
	root.add(body);
	const core = kit.named("core", kit.sphere(0.06, heart, [1, 1.15, 1], 12));
	core.position.y = 0.02;
	body.add(core);
	const flame = kit.sphere(0.045, heart, [0.75, 1.7, 0.75], 10);
	flame.position.y = 0.09;
	body.add(flame);
	const bell = kit.named(
		"bell",
		kit.pleatedLathe(
			WISP_BELL,
			glass,
			8,
			(_radius, height) => (height < 0 ? 0.1 : 0.02),
			24,
		),
	);
	body.add(bell);
	for (let index = 0; index < 5; index += 1) {
		const angle = (index / 5) * Math.PI * 2;
		const ribbon = kit.named(
			`veil_${index}`,
			kit.mesh(
				new THREE.PlaneGeometry(0.07, 0.42).translate(0, -0.21, 0),
				veil,
			),
		);
		ribbon.rotation.order = "YXZ";
		ribbon.position.set(Math.cos(angle) * 0.16, -0.1, Math.sin(angle) * 0.16);
		ribbon.rotation.y = Math.PI / 2 - angle;
		bell.add(ribbon);
	}
	return root;
}

export function buildHurleur(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "hurleur";
	const dark: MaterialOptions = { color: 0x2a1e1c, roughness: 0.85 };
	const membrane: MaterialOptions = {
		color: 0x1e1414,
		roughness: 0.85,
		side: THREE.DoubleSide,
	};
	const flesh = kit.owned("flesh", {
		color: 0x6e605c,
		roughness: 0.8,
		emissive: 0xff2a10,
		emissiveIntensity: 0,
	});
	const head = kit.pivot("head");
	root.add(head);
	head.add(kit.sphere(0.22, flesh, [1, 0.95, 1.1], 16));
	head.add(kit.anchor("spout", 0, 0, 0.26));
	([-1, 1] as const).forEach((side, index) => {
		const ear = kit.cone(0.1, 0.3, dark, 8);
		ear.scale.z = 0.4;
		ear.position.set(side * 0.13, 0.23, -0.04);
		ear.rotation.z = -side * 0.5;
		head.add(ear);
		const wing = kit.pivot(`wing_${index}`, side * 0.18, 0.04, -0.05);
		head.add(wing);
		const skin = kit.mesh(
			new THREE.ShapeGeometry(
				new THREE.Shape([
					new THREE.Vector2(0, 0.02),
					new THREE.Vector2(0.52, 0.14),
					new THREE.Vector2(0.68, -0.04),
					new THREE.Vector2(0.52, -0.06),
					new THREE.Vector2(0.46, -0.17),
					new THREE.Vector2(0.33, -0.06),
					new THREE.Vector2(0.22, -0.19),
					new THREE.Vector2(0.1, -0.07),
					new THREE.Vector2(0, -0.08),
				]),
			),
			membrane,
		);
		skin.rotation.x = -Math.PI / 2;
		skin.scale.x = side;
		wing.add(skin);
		wing.add(
			kit.tube(
				[
					[0, 0, 0],
					[side * 0.3, 0.01, -0.1],
					[side * 0.52, 0, -0.14],
					[side * 0.68, 0, 0.04],
				],
				(t) => 0.026 - t * 0.012,
				dark,
				10,
				6,
			),
		);
	});
	for (const side of [-1, 1]) {
		const fang = kit.cone(0.024, 0.075, TEETH, 6);
		fang.rotation.x = Math.PI;
		fang.position.set(side * 0.05, -0.21, 0.12);
		head.add(fang);
	}
	head.add(
		kit.tube(
			[
				[0, -0.05, -0.18],
				[0, -0.1, -0.34],
				[0, -0.02, -0.5],
			],
			(t) => 0.045 * (1 - t) + 0.006,
			dark,
			10,
			6,
		),
	);
	return root;
}

export function buildArchiviste(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "archiviste";
	const figure = kit.pivot("figure");
	root.add(figure);
	const paper: MaterialOptions = {
		texture: "paperPages",
		color: 0x6e5c48,
		roughness: 0.95,
		side: THREE.DoubleSide,
		fixedRepeat: true,
	};
	const leaves = kit.owned("leaves", { color: 0xffe090, unlit: true });
	const sight = kit.owned("sight", { color: 0xffc840, unlit: true });
	const robe = kit.lathe(ARCHIVIST_ROBE, paper, 20);
	robe.position.y = ARCHIVIST_ROBE_BASE;
	figure.add(robe);
	const hood = kit.mesh(hoodGeometry(0.22, 0.9), paper);
	hood.scale.set(0.95, 1.12, 1);
	hood.position.set(0, 2.0, 0.02);
	figure.add(hood);
	const shadow = kit.sphere(0.2, SOCKET, [0.92, 1.05, 0.9], 14);
	shadow.position.set(0, 2.0, 0.02);
	figure.add(shadow);
	for (const side of [-1, 1]) {
		const eye = kit.sphere(0.032, sight, [1, 0.75, 0.5], 10);
		eye.position.set(side * 0.056, 2.0, 0.185);
		figure.add(eye);
	}
	for (const side of [-1, 1]) {
		figure.add(
			kit.tube(
				[
					[side * 0.17, 1.66, 0.02],
					[side * 0.24, 1.52, 0.16],
					[side * 0.2, 1.47, 0.3],
				],
				(t) => 0.065 - t * 0.012,
				paper,
				8,
				8,
			),
		);
	}
	const tome = kit.pivot("tome", 0, 1.45, 0.34);
	tome.rotation.x = -0.5;
	figure.add(tome);
	tome.add(
		kit.box(0.5, 0.025, 0.34, {
			texture: "leather",
			color: 0x5a1a14,
			roughness: 0.7,
		}),
	);
	for (const side of [-1, 1]) {
		const leaf = kit.box(0.22, 0.04, 0.31, leaves);
		leaf.position.set(side * 0.115, 0.03, 0);
		leaf.rotation.z = -side * 0.14;
		tome.add(leaf);
	}
	const colors = [0x5a1a16, 0x1a2a4a, 0x1e3a1e, 0x4a3414, 0x2a1a34];
	for (let index = 0; index < ARCHIVIST_BOOKS; index += 1) {
		figure.add(
			kit.named(
				`book_${index}`,
				kit.box(0.24, 0.32, 0.07, {
					texture: "leather",
					color: colors[index % colors.length],
					roughness: 0.75,
				}),
			),
		);
	}
	for (let index = 0; index < ARCHIVIST_PAGES; index += 1) {
		figure.add(
			kit.named(
				`page_${index}`,
				kit.mesh(new THREE.PlaneGeometry(0.18, 0.24), paper),
			),
		);
	}
	return root;
}

export function buildDoubleParts(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "double";
	const throat = kit.owned("throat", { color: 0xff3a1a, unlit: true });
	const hate = kit.owned("hate", { color: 0xff2a14, unlit: true });
	const core = kit.pivot("core", 0, 0.7, 0);
	core.add(
		kit.sphere(0.2, { color: 0x2a0505, roughness: 0.55 }, [1, 0.35, 1], 16),
	);
	const glowing = kit.sphere(0.15, throat, [1, 0.32, 1], 12);
	glowing.position.y = 0.03;
	core.add(glowing);
	for (let index = 0; index < 9; index += 1) {
		const angle = (index / 9) * Math.PI * 2;
		const fang = kit.cone(0.032, index % 2 === 0 ? 0.15 : 0.1, TEETH, 5);
		fang.position.set(Math.sin(angle) * 0.17, 0.07, Math.cos(angle) * 0.17);
		core.add(fang);
	}
	core.add(kit.anchor("maw", 0, 0.06, 0.1));
	root.add(core);
	const upperTeeth = kit.pivot("upper_teeth");
	for (let index = 0; index < 12; index += 1) {
		const angle = (index / 12) * Math.PI * 2;
		const fang = kit.cone(0.036, index % 3 === 0 ? 0.2 : 0.12, TEETH, 5);
		fang.rotation.x = Math.PI;
		fang.position.set(Math.sin(angle) * 0.3, -0.08, Math.cos(angle) * 0.28);
		upperTeeth.add(fang);
	}
	root.add(upperTeeth);
	const eyes = kit.pivot("eyes");
	for (const side of [-1, 1]) {
		const eye = kit.sphere(0.042, hate, [0.8, 1.25, 0.5], 10);
		eye.position.set(side * 0.088, 0.49, 0.245);
		eye.rotation.y = side * 0.22;
		eyes.add(eye);
	}
	root.add(eyes);
	let index = 0;
	for (const side of [-1, 1]) {
		for (const lean of [-0.25, 0.25]) {
			const claw = kit.named(
				`claw_${index}`,
				kit.cone(0.04, 0.32, { color: 0x140f0c }, 5),
			);
			claw.position.set(side * (0.3 + lean * 0.08), 0.25, 0.15 + lean * 0.1);
			claw.rotation.set(Math.PI * 0.8, 0, side * lean);
			root.add(claw);
			index += 1;
		}
	}
	return root;
}
