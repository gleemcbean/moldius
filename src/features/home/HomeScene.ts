import { DEFAULT_HAT_PATTERN, type HatPattern } from "@shared/hatPatterns";
import {
	ChaseDirector,
	randomChaseCourse,
} from "@shared/showcase/chaseDirector";
import * as THREE from "three";
import { QUALITY_PRESETS } from "../../config/graphics";
import { AmbientMotes } from "../engine/effects/AmbientMotes";
import { LightPool } from "../engine/lighting/LightPool";
import { PostEffects } from "../engine/render/PostEffects";
import { DoorViews } from "../engine/world/DoorViews";
import { ReverbereModel } from "../models/anomalies/bipeds";
import { MushroomModel } from "../models/MushroomModel";
import { ModelKit, modelYaw } from "../models/modelKit";
import { settingsStore } from "../settings/settingsStore";
import { ManorMeshBuilder } from "../world/ManorMeshBuilder";
import { MaterialLibrary } from "../world/MaterialLibrary";
import { TextureLibrary } from "../world/textures/TextureLibrary";

const STRIDE_SPEED = 4.6;

export class HomeScene {
	private readonly renderer: THREE.WebGLRenderer;
	private readonly scene = new THREE.Scene();
	private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);
	private readonly textures = new TextureLibrary(2);
	private readonly materials = new MaterialLibrary(this.textures);
	private readonly kit = new ModelKit(this.materials);
	private readonly director: ChaseDirector;
	private readonly doors: DoorViews;
	private readonly lights: LightPool;
	private readonly post: PostEffects;
	private readonly motes = new AmbientMotes();
	private mushroom: MushroomModel;
	private readonly hunter: ReverbereModel;
	private readonly lantern = new THREE.PointLight(0xffb060, 9, 11, 2);
	private readonly hunterEye = new THREE.PointLight(0xff5a3a, 0.8, 2.2, 2);
	private frame = 0;
	private time = 0;
	/** Appelé une fois, après la première image : l'écran de chargement peut partir. */
	onFirstFrame: (() => void) | null = null;
	private last = performance.now();
	private readonly observer: ResizeObserver;

	constructor(
		private readonly host: HTMLElement,
		private color: number,
		private pattern: HatPattern = DEFAULT_HAT_PATTERN,
	) {
		this.renderer = new THREE.WebGLRenderer({
			antialias: false,
			powerPreference: "low-power",
		});
		const settings = settingsStore.get();
		this.renderer.setPixelRatio(
			QUALITY_PRESETS[settings.quality].pixelRatio * settings.renderScale,
		);
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		host.appendChild(this.renderer.domElement);
		this.post = new PostEffects(this.renderer, 0);
		this.scene.background = new THREE.Color(0x140c07);
		this.scene.fog = new THREE.FogExp2(0x140c07, 0.045);
		this.scene.add(new THREE.HemisphereLight(0xa4907c, 0x44301e, 2.1));
		this.scene.add(this.motes.points);

		const course = randomChaseCourse();
		this.director = new ChaseDirector(course);
		const { layout } = course;
		const builder = new ManorMeshBuilder(layout, this.materials);
		for (const id of course.visibleRooms) {
			this.scene.add(builder.buildRoom(layout.rooms[id]).group);
		}
		this.doors = new DoorViews(layout, this.kit);
		const route = new Set(course.loop.openings);
		for (const door of this.doors.doors.values()) {
			if (route.has(door.opening.id)) {
				this.doors.setOpen(door.doorId, true);
			}
		}
		this.doors.update(10);
		this.scene.add(this.doors.group);
		const visible = new Set(course.visibleRooms);
		this.lights = new LightPool(
			this.scene,
			6,
			layout.lights.filter((light) => visible.has(light.roomId)),
		);

		this.mushroom = new MushroomModel(this.kit, color, pattern);
		this.hunter = new ReverbereModel(this.kit);
		this.scene.add(
			this.mushroom.root,
			this.hunter.root,
			this.lantern,
			this.hunterEye,
		);
		this.observer = new ResizeObserver(() => this.resize());
		this.observer.observe(host);
		this.resize();
		this.frame = requestAnimationFrame(this.loop);
	}

	setAppearance(color: number, pattern: HatPattern): void {
		if (color === this.color && pattern === this.pattern) {
			return;
		}
		this.color = color;
		this.pattern = pattern;
		const position = this.mushroom.root.position.clone();
		const rotation = this.mushroom.root.rotation.clone();
		this.scene.remove(this.mushroom.root);
		this.mushroom.dispose();
		this.mushroom = new MushroomModel(this.kit, color, pattern);
		this.mushroom.root.position.copy(position);
		this.mushroom.root.rotation.copy(rotation);
		this.scene.add(this.mushroom.root);
	}

	private resize(): void {
		const width = this.host.clientWidth || window.innerWidth;
		const height = this.host.clientHeight || window.innerHeight;
		this.renderer.setSize(width, height, false);
		this.renderer.domElement.style.width = "100%";
		this.renderer.domElement.style.height = "100%";
		this.camera.aspect = width / Math.max(1, height);
		if (width > height * 1.1) {
			this.camera.setViewOffset(width * 1.38, height, 0, 0, width, height);
		} else {
			this.camera.clearViewOffset();
		}
		this.camera.updateProjectionMatrix();
	}

	private readonly loop = (now: number) => {
		this.frame = requestAnimationFrame(this.loop);
		const dt = Math.min(0.05, (now - this.last) / 1000);
		this.last = now;
		this.time += dt;
		const shot = this.director.update(dt);

		this.mushroom.root.position.set(
			shot.runner.x,
			shot.runner.y,
			shot.runner.z,
		);
		this.mushroom.root.rotation.y =
			modelYaw(shot.runnerYaw) + Math.sin(this.time * 3.4) * 0.1;
		this.mushroom.update(dt, {
			speed: STRIDE_SPEED,
			crouch: 0,
			grounded: true,
			sprinting: true,
			lanternOpen: true,
			grimoireOpen: false,
			dead: false,
			talking: 0,
		});
		this.hunter.root.position.set(shot.hunter.x, shot.hunter.y, shot.hunter.z);
		this.hunter.root.rotation.y = modelYaw(shot.hunterYaw);
		this.hunter.update({
			state: shot.lunge > 0 ? "windup" : "chase",
			stateMs: shot.lunge * 600,
			extra: 0,
			speed: STRIDE_SPEED * 0.95,
			dt,
			time: this.time,
		});

		this.mushroom.root.updateMatrixWorld(true);
		this.lantern.position.copy(this.mushroom.lanternLightPosition);
		this.lantern.intensity =
			8.5 + Math.sin(this.time * 17) * 0.7 + Math.sin(this.time * 29) * 0.4;
		const glow = this.hunter.glow;
		if (glow) {
			this.hunterEye.position
				.copy(glow.offset)
				.applyQuaternion(this.hunter.root.quaternion)
				.add(this.hunter.root.position);
			this.hunterEye.color.setHex(glow.color);
			this.hunterEye.intensity = glow.intensity;
			this.hunterEye.distance = glow.radius;
		}

		this.camera.position.set(
			shot.camera.x,
			shot.camera.y + Math.sin(this.time * 7) * 0.01,
			shot.camera.z,
		);
		this.camera.lookAt(shot.target.x, shot.target.y, shot.target.z);

		this.renderer.toneMappingExposure = Math.min(1, this.time / 0.8) * 1.05;
		this.doors.update(dt);
		this.lights.update(this.camera.position, [], dt);
		this.motes.update(dt, this.camera.position);
		const settings = settingsStore.get();
		this.post.render(
			{
				dt,
				strength: settings.ambiance,
				tension: shot.lunge > 0 ? 0.7 : 0.2,
				animated: !settings.reduceMotion,
				levels: settings.colorLevels,
			},
			() => this.renderer.render(this.scene, this.camera),
		);
		if (this.onFirstFrame) {
			const done = this.onFirstFrame;
			this.onFirstFrame = null;
			done();
		}
	};

	dispose(): void {
		cancelAnimationFrame(this.frame);
		this.observer.disconnect();
		this.lights.dispose(this.scene);
		this.motes.dispose();
		this.scene.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}
		});
		this.materials.dispose();
		this.textures.dispose();
		this.post.dispose();
		this.renderer.dispose();
		this.renderer.forceContextLoss();
		this.renderer.domElement.remove();
	}
}
