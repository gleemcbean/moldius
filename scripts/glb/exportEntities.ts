import path from "node:path";
import * as THREE from "three";
import { SPECIES_IDS, type SpeciesId } from "../../shared/config/species.js";
import { DEFAULT_HAT_PATTERN } from "../../shared/hatPatterns.js";
import { DEFAULT_PLAYER_COLOR } from "../../shared/playerColors.js";
import { FirstPersonBody } from "../../src/features/engine/player/FirstPersonBody.js";
import { createAnomalyModel } from "../../src/features/models/anomalies/createAnomalyModel.js";
import { MushroomModel } from "../../src/features/models/MushroomModel.js";
import {
	type ExportContext,
	exportObjectToGlb,
	type GlbReport,
	type PlaceholderSet,
} from "./placeholderMaterials.js";

const ARM_ELBOW_RADIUS = 0.085;
const ARM_HAND_RADIUS = 0.062;
const ARM_LENGTH = 0.6;
const ARM_TIP_STEPS = 6;

export function applyLanternPlaceholders(
	lanternRoot: THREE.Object3D,
	placeholders: PlaceholderSet,
): void {
	lanternRoot.traverse((obj) => {
		if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
		const mat = obj.material;
		const mapName =
			mat instanceof THREE.MeshBasicMaterial ||
			mat instanceof THREE.MeshStandardMaterial
				? (mat.map?.name ?? "")
				: "";
		if (mapName === "flame" || mapName === "flameNeutral") {
			obj.material = placeholders.dyn_lantern_flame;
		} else if (
			mat instanceof THREE.MeshStandardMaterial &&
			mat.transparent &&
			mat.opacity < 0.5
		) {
			obj.material = placeholders.dyn_lantern_glass;
		}
	});
}

function applyMushroomPlaceholders(
	root: THREE.Object3D,
	placeholders: PlaceholderSet,
): void {
	root.traverse((obj) => {
		if (obj.name === "cap") {
			const capMesh = obj.children.find(
				(c): c is THREE.Mesh => c instanceof THREE.Mesh,
			);
			if (capMesh) {
				capMesh.material = placeholders.dyn_player_cap;
			}
		}
	});
	applyLanternPlaceholders(root, placeholders);
}

function applyAnomalyPlaceholders(
	root: THREE.Object3D,
	placeholders: PlaceholderSet,
): void {
	let emissiveIdx = 0;
	root.traverse((obj) => {
		if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
		const mat = obj.material;
		if (mat instanceof THREE.MeshBasicMaterial) {
			if (mat.alphaMap) {
				obj.material = placeholders.dyn_veilleur_beam;
			} else if (!mat.map && !mat.name.startsWith("dyn_")) {
				mat.name =
					emissiveIdx === 0
						? "dyn_anomaly_emissive"
						: `dyn_anomaly_emissive_${emissiveIdx}`;
				emissiveIdx += 1;
			}
		}
	});
}

function createFirstPersonArmsGroup(): {
	group: THREE.Group;
	dispose: () => void;
} {
	const half = ARM_LENGTH / 2;
	const tipHeight = ARM_HAND_RADIUS * 0.8;
	const profile = [
		new THREE.Vector2(0.001, -half),
		new THREE.Vector2(ARM_ELBOW_RADIUS, -half + 0.03),
	];
	for (let step = 0; step <= ARM_TIP_STEPS; step += 1) {
		const angle = (step / ARM_TIP_STEPS) * (Math.PI / 2);
		profile.push(
			new THREE.Vector2(
				Math.max(0.001, Math.cos(angle) * ARM_HAND_RADIUS),
				half - tipHeight + Math.sin(angle) * tipHeight,
			),
		);
	}
	const geometry = new THREE.LatheGeometry(profile, 20);
	const material = new THREE.MeshStandardMaterial({
		name: "dyn_fp_arm_skin",
		color: 0xa58a6a,
		roughness: 0.85,
	});
	const group = new THREE.Group();
	group.name = "first_person_arms";

	const leftArm = new THREE.Mesh(geometry, material);
	leftArm.name = "left_arm";
	leftArm.position.set(-0.22, 0, 0);
	const rightArm = new THREE.Mesh(geometry, material);
	rightArm.name = "right_arm";
	rightArm.position.set(0.22, 0, 0);
	group.add(leftArm, rightArm);

	return {
		group,
		dispose: () => {
			geometry.dispose();
			material.dispose();
		},
	};
}

export async function exportEntities(
	ctx: ExportContext,
	baseOutDir: string,
	onlySpecies?: readonly SpeciesId[],
): Promise<GlbReport[]> {
	const reports: GlbReport[] = [];
	const speciesList = onlySpecies ? [...onlySpecies] : [...SPECIES_IDS];

	for (const species of speciesList) {
		const model = createAnomalyModel(
			species,
			ctx.kit,
			DEFAULT_PLAYER_COLOR,
			DEFAULT_HAT_PATTERN,
			null,
		);
		if (species === "double") {
			model.update({
				state: "special",
				stateMs: 900,
				extra: 1,
				speed: 0,
				dt: 0.016,
				time: 0,
			});
			model.preparePortrait();
			applyMushroomPlaceholders(model.root, ctx.placeholders);
		} else {
			model.update({
				state: "idle",
				stateMs: 0,
				extra: 0,
				speed: 0,
				dt: 0.016,
				time: 0,
			});
		}
		applyAnomalyPlaceholders(model.root, ctx.placeholders);
		model.root.name = species;
		const report = await exportObjectToGlb(
			model.root,
			path.join(baseOutDir, "anomalies", `${species}.glb`),
		);
		reports.push(report);
		model.dispose();
	}

	const mushroom = new MushroomModel(
		ctx.kit,
		DEFAULT_PLAYER_COLOR,
		DEFAULT_HAT_PATTERN,
		null,
	);
	mushroom.update(0.016, {
		speed: 0,
		crouch: 0,
		grounded: true,
		sprinting: false,
		lanternOpen: true,
		grimoireOpen: false,
		dead: false,
		talking: 0,
	});
	applyMushroomPlaceholders(mushroom.root, ctx.placeholders);
	mushroom.root.name = "mushroom";
	reports.push(
		await exportObjectToGlb(
			mushroom.root,
			path.join(baseOutDir, "player", "mushroom.glb"),
		),
	);
	mushroom.dispose();

	const fpBody = new FirstPersonBody(ctx.kit);
	fpBody.update(0.016, {
		x: 0,
		y: 0,
		z: 0,
		yaw: 0,
		speed: 0,
		crouch: 0,
		grounded: true,
		visible: true,
	});
	fpBody.root.name = "first_person_body";
	reports.push(
		await exportObjectToGlb(
			fpBody.root,
			path.join(baseOutDir, "player", "first_person_body.glb"),
		),
	);
	fpBody.dispose();

	const arms = createFirstPersonArmsGroup();
	reports.push(
		await exportObjectToGlb(
			arms.group,
			path.join(baseOutDir, "player", "first_person_arms.glb"),
		),
	);
	arms.dispose();

	return reports;
}
