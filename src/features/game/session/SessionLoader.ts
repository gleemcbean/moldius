import {
	EYE_HEIGHT_STANDING,
	LANTERN_LIGHT_RANGE,
	OCCULT_RECIPES,
} from "@shared/config/index";
import { DEFAULT_HAT_PATTERN } from "@shared/hatPatterns";
import { assignRecipeMaterials } from "@shared/manor/furnish/pickups";
import { layoutChecksum } from "@shared/manor/generateManor";
import type { ManorLayout } from "@shared/manor/types";
import { CollisionWorld } from "@shared/physics/collisionWorld";
import type { MatchInit } from "@shared/protocol/game";
import * as THREE from "three";
import { QUALITY_PRESETS } from "../../../config/graphics";
import { currentMessages } from "../../../i18n";
import type { LoadStepId } from "../../../i18n/sections/game";
import { audioEngine } from "../../audio/audioEngine";
import { soundBank } from "../../audio/soundBank";
import { AmbientAudio } from "../../engine/audio/AmbientAudio";
import { AmbientMotes } from "../../engine/effects/AmbientMotes";
import { HazardViews } from "../../engine/effects/HazardViews";
import { ParticleSystem } from "../../engine/effects/Particles";
import { AnomalyViews } from "../../engine/entities/AnomalyViews";
import { RemotePlayers } from "../../engine/entities/RemotePlayers";
import { LightPool } from "../../engine/lighting/LightPool";
import { FirstPersonBody } from "../../engine/player/FirstPersonBody";
import { FirstPersonRig } from "../../engine/player/FirstPersonRig";
import { PostEffects } from "../../engine/render/PostEffects";
import { ClientWorldState } from "../../engine/state/ClientWorldState";
import { AltarViews } from "../../engine/world/AltarViews";
import { DoorViews } from "../../engine/world/DoorViews";
import { PickupViews } from "../../engine/world/PickupViews";
import { GrimoireController } from "../../grimoire/GrimoireController";
import { renderIllustrations } from "../../grimoire/illustrations";
import { renderObjectArt } from "../../grimoire/objectArt";
import { ensurePageFonts } from "../../grimoire/pageRenderer";
import { createAnomalyModel } from "../../models/anomalies/createAnomalyModel";
import { ModelKit } from "../../models/modelKit";
import { getSocket } from "../../network/socket";
import { settingsStore } from "../../settings/settingsStore";
import {
	ManorMeshBuilder,
	type RoomMeshes,
} from "../../world/ManorMeshBuilder";
import { MaterialLibrary } from "../../world/MaterialLibrary";
import { TextureLibrary } from "../../world/textures/TextureLibrary";

export type { LoadStepId };

export const LOAD_STEPS: readonly LoadStepId[] = [
	"manor",
	"collisions",
	"textures",
	"architecture",
	"models",
	"grimoire",
	"audio",
	"gpu",
];

export interface LoadedWorld {
	pickups: PickupViews;
	altars: AltarViews;
	layout: ManorLayout;
	world: CollisionWorld;
	state: ClientWorldState;
	renderer: THREE.WebGLRenderer;
	post: PostEffects;
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	textures: TextureLibrary;
	materials: MaterialLibrary;
	kit: ModelKit;
	rooms: RoomMeshes[];
	doors: DoorViews;
	hazards: HazardViews;
	particles: ParticleSystem;
	motes: AmbientMotes;
	lights: LightPool;
	rig: FirstPersonRig;
	body: FirstPersonBody;
	remotePlayers: RemotePlayers;
	anomalies: AnomalyViews;
	grimoire: GrimoireController;
	worldLantern: THREE.PointLight;
	ambient: THREE.HemisphereLight;
	ambientAudio: AmbientAudio;
}

type Progress = (step: LoadStepId, fraction: number) => void;

function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function generateLayout(init: MatchInit): Promise<ManorLayout> {
	const worker = new Worker(
		new URL("../generation.worker.ts", import.meta.url),
		{
			type: "module",
		},
	);
	try {
		const result = await new Promise<{ layout: ManorLayout; checksum: number }>(
			(resolve, reject) => {
				worker.onmessage = (
					event: MessageEvent<{ layout: ManorLayout; checksum: number }>,
				) => resolve(event.data);
				worker.onerror = (event) => reject(new Error(event.message));
				worker.postMessage({ seed: init.seed, config: init.config });
			},
		);
		if (result.checksum === init.layoutChecksum) {
			return result.layout;
		}
	} finally {
		worker.terminate();
	}
	return requestServerLayout(init);
}

function requestServerLayout(init: MatchInit): Promise<ManorLayout> {
	const socket = getSocket();
	return new Promise((resolve, reject) => {
		const timeout = window.setTimeout(
			() => reject(new Error(currentMessages().game.loading.layoutUnavailable)),
			20000,
		);
		socket.once("game:layout", ({ matchId, layoutJson }) => {
			window.clearTimeout(timeout);
			if (matchId !== init.matchId) {
				reject(new Error(currentMessages().game.loading.layoutOtherMatch));
				return;
			}
			const layout = JSON.parse(layoutJson) as ManorLayout;
			if (layoutChecksum(layout) !== init.layoutChecksum) {
				reject(new Error(currentMessages().game.loading.layoutMismatch));
				return;
			}
			resolve(layout);
		});
		socket.emit("game:layoutRequest", { matchId: init.matchId });
	});
}

function spawn0(init: MatchInit, selfId: string) {
	return (
		init.players.find((player) => player.id === selfId)?.spawn ?? {
			x: 0,
			y: 0,
			z: 0,
			yaw: 0,
		}
	);
}

export async function loadSession(
	init: MatchInit,
	selfId: string,
	progress: Progress,
): Promise<LoadedWorld> {
	const settings = settingsStore.get();
	const preset = QUALITY_PRESETS[settings.quality];
	progress("manor", 0.1);
	const layout = await generateLayout(init);
	progress("manor", 1);

	const world = new CollisionWorld(layout);
	const state = new ClientWorldState(init, layout, world, selfId);
	progress("collisions", 1);
	await nextFrame();

	const renderer = new THREE.WebGLRenderer({
		antialias: preset.antialias,
		powerPreference: "high-performance",
		stencil: false,
	});
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = settings.brightness;
	renderer.shadowMap.enabled = settings.shadows;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.autoClear = false;
	const post = new PostEffects(renderer, preset.antialias ? 4 : 0);
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x0b0b0c);
	scene.fog = new THREE.FogExp2(0x0b0b0c, 0.062);
	const camera = new THREE.PerspectiveCamera(settings.fov, 16 / 9, 0.03, 90);
	scene.add(camera);
	const ambient = new THREE.HemisphereLight(0x84868c, 0x2c2c2e, 0.72);
	scene.add(ambient);
	const worldLantern = new THREE.PointLight(
		0xffb060,
		0,
		LANTERN_LIGHT_RANGE,
		2,
	);
	worldLantern.castShadow = settings.shadows;
	worldLantern.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
	worldLantern.shadow.bias = -0.002;
	worldLantern.shadow.camera.near = 0.1;
	worldLantern.shadow.camera.far = LANTERN_LIGHT_RANGE;
	scene.add(worldLantern);

	const anisotropy = Math.min(
		preset.textureAnisotropy,
		renderer.capabilities.getMaxAnisotropy(),
	);
	const textures = new TextureLibrary(anisotropy);
	const keys = textures.keys;
	for (const [index, key] of keys.entries()) {
		textures.build(key);
		if (index % 8 === 7) {
			progress("textures", (index + 1) / keys.length);
			await nextFrame();
		}
	}
	progress("textures", 1);

	const materials = new MaterialLibrary(textures);
	const kit = new ModelKit(materials);
	const builder = new ManorMeshBuilder(layout, materials);
	const rooms: RoomMeshes[] = [];
	for (const [index, room] of layout.rooms.entries()) {
		const built = builder.buildRoom(room);
		built.group.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.receiveShadow = settings.shadows;
				object.castShadow = settings.shadows;
			}
		});
		scene.add(built.group);
		rooms.push(built);
		if (index % 2 === 1) {
			progress("architecture", (index + 1) / layout.rooms.length);
			await nextFrame();
		}
	}
	const doors = new DoorViews(layout, kit);
	scene.add(doors.group);
	progress("architecture", 1);

	const particles = new ParticleSystem();
	particles.scale = settings.effects ? preset.particleScale : 0.25;
	scene.add(particles.points);
	const motes = new AmbientMotes(settings.effects ? 1 : 0.35);
	scene.add(motes.points);
	const hazards = new HazardViews(state, layout, materials, particles);
	scene.add(hazards.group);
	const tutorialObject = init.tutorial ? init.roster[0]?.occult : null;
	if (tutorialObject) {
		assignRecipeMaterials(layout.pickups, OCCULT_RECIPES[tutorialObject]);
	}
	const pickups = new PickupViews(layout, kit);
	scene.add(pickups.group);
	const altars = new AltarViews(layout, kit);
	scene.add(altars.group);
	const lights = new LightPool(scene, preset.lightPool, layout.lights);
	lights.reduceFlicker = settings.reduceMotion;
	const rig = new FirstPersonRig(kit);
	camera.add(rig.root);
	const body = new FirstPersonBody(kit);
	scene.add(body.root);
	progress("models", 0.3);
	await nextFrame();
	const appearances = new Map(
		init.players.map((player) => [
			player.id,
			{ color: player.color, pattern: player.pattern },
		]),
	);
	const remotePlayers = new RemotePlayers(state, kit, world);
	scene.add(remotePlayers.group);
	const anomalies = new AnomalyViews(
		state,
		kit,
		textures,
		world,
		particles,
		(id) =>
			appearances.get(id) ?? { color: 0xd8442f, pattern: DEFAULT_HAT_PATTERN },
	);
	scene.add(anomalies.group);
	progress("models", 1);
	await nextFrame();

	await ensurePageFonts();
	const illustrations = await renderIllustrations(
		renderer,
		kit,
		init.pool,
		(fraction) => progress("grimoire", fraction * 0.6),
	);
	const objectArt = renderObjectArt(renderer, kit);
	const grimoire = new GrimoireController(
		init,
		rig.grimoire,
		illustrations,
		objectArt,
		anisotropy,
		(id) => state.anomalies.get(id)?.active ?? false,
	);
	const pageTextures = await grimoire.build((fraction) =>
		progress("grimoire", 0.6 + fraction * 0.4),
	);

	await audioEngine.resume();
	await soundBank.load((fraction) => progress("audio", fraction));
	const ambientAudio = new AmbientAudio(layout, world);

	progress("gpu", 0.1);
	for (const texture of [...textures.all(), ...pageTextures]) {
		renderer.initTexture(texture);
	}
	progress("gpu", 0.4);
	const warmModels = init.pool.map((species) =>
		createAnomalyModel(species, kit),
	);
	for (const model of warmModels) {
		model.root.position.set(
			spawn0(init, selfId).x,
			-40,
			spawn0(init, selfId).z,
		);
		model.update({
			state: "idle",
			stateMs: 0,
			extra: 0,
			speed: 0,
			dt: 0.016,
			time: 0,
		});
		scene.add(model.root);
	}
	await nextFrame();
	const spawn = spawn0(init, selfId);
	camera.position.set(spawn.x, spawn.y + EYE_HEIGHT_STANDING, spawn.z);
	camera.rotation.set(0, spawn.yaw, 0, "YXZ");
	camera.updateMatrixWorld(true);
	try {
		await renderer.compileAsync(scene, camera);
	} catch {
		renderer.compile(scene, camera);
	}
	for (const model of warmModels) {
		scene.remove(model.root);
		model.dispose();
	}
	progress("gpu", 1);

	return {
		layout,
		world,
		state,
		renderer,
		post,
		scene,
		camera,
		textures,
		materials,
		kit,
		rooms,
		doors,
		hazards,
		pickups,
		altars,
		particles,
		motes,
		lights,
		rig,
		body,
		remotePlayers,
		anomalies,
		grimoire,
		worldLantern,
		ambient,
		ambientAudio,
	};
}
