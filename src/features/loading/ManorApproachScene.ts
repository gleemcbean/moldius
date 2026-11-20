import type { HatPattern } from "@shared/hatPatterns";
import { SeededRandom } from "@shared/random";
import {
	DEFAULT_LANTERN_TINT,
	LANTERN_TINT_COLORS,
	type LanternTint,
} from "@shared/rewards";
import * as THREE from "three";
import {
	QUALITY_PRESETS,
	renderPixelRatio,
	surfaceQuality,
} from "../../config/graphics";
import { AmbientMotes } from "../engine/effects/AmbientMotes";
import { PostEffects } from "../engine/render/PostEffects";
import { modelLibrary } from "../models/ModelLibrary";
import { MushroomModel } from "../models/MushroomModel";
import { ModelKit, modelYaw } from "../models/modelKit";
import { settingsStore } from "../settings/settingsStore";
import { MaterialLibrary } from "../world/MaterialLibrary";
import { TextureLibrary } from "../world/textures/TextureLibrary";
import {
	loadImage,
	preloadSpecialTextures,
	reflectionFiles,
	surfaceFiles,
} from "../world/textures/textureFiles";
import { buildGrounds } from "./approach/grounds";
import {
	MOON_DIRECTION,
	MOON_LIGHT_FROM,
	PATH_LENGTH,
	SECOND_MOON_DIRECTION,
	SKY_RADIUS,
	START_Z,
	TOWER_FRONT_Z,
	TOWER_TOP,
} from "./approach/layout";
import { buildManor } from "./approach/manor";
import { MysticDecor } from "./approach/mystic";
import { SCENE_SURFACES } from "./approach/palette";
import { moonTexture, skyMaterial, softDotTexture } from "./approach/sky";

export interface ApproachWalker {
	id: string;
	color: number;
	pattern: HatPattern;
	lantern: LanternTint;
}

const MODELS = [
	"player/mushroom",
	"tools/lantern",
	"tools/camera",
	"tools/walkie",
	"furniture/wallLantern",
	"furniture/urn",
];

const WALK_SPEED = 2.6;
const RUSH_SPEED = 6;
const SPRINT_FROM = 3.6;
const MIN_PACE = 0.5;
const DOOR_OPEN_S = 0.9;
const DOOR_REACH = 6;
const ARRIVAL_PAUSE_S = 0.15;
const ARRIVAL_PACE = 3;
const LOADING_GAIN = 1.2;
const ARRIVAL_GAIN = 3;
const TEXTURE_UPLOADS_PER_FRAME = 4;
const COMPILE_TIMEOUT_MS = 3000;
const MAX_MOVE_STEP_S = 0.5;
const MAX_ANIMATION_STEP_S = 0.05;
const MAX_PIXEL_RATIO = 0.8;
const ENTRY_RUN = 4;
const LOADING_REACH = 0.94;
const ROW_GAP = 1.05;
const COLUMN_GAP = 0.85;
const MAX_LANTERN_LIGHTS = 2;
const DEFAULT_LANTERN_LIGHT = 0xffb060;
const PITCH_START = THREE.MathUtils.degToRad(12);
const PITCH_END = THREE.MathUtils.degToRad(19);
const LOOK_DISTANCE = 20;
const BAT_COUNT = 4;
const DOOR_LIGHT_COLOR = 0xc98aff;
const NIGHT_COLOR = 0x0b0918;
const FOG_COLOR = 0x191330;

interface Walker {
	model: MushroomModel;
	shadow: THREE.Mesh;
	light: THREE.PointLight | null;
	column: number;
	row: number;
	jitter: number;
	advance: number;
	gaze: number;
}

interface Bat {
	root: THREE.Group;
	wings: THREE.Mesh[];
	radius: number;
	height: number;
	speed: number;
	phase: number;
}

function pixelRatio(): number {
	const { quality, renderScale } = settingsStore.get();

	return Math.min(MAX_PIXEL_RATIO, renderPixelRatio(quality, renderScale));
}

function lanternColor(tint: LanternTint): number | null {
	return tint === DEFAULT_LANTERN_TINT ? null : LANTERN_TINT_COLORS[tint];
}

export class ManorApproachScene {
	private readonly renderer: THREE.WebGLRenderer;
	private readonly scene = new THREE.Scene();
	private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.05, 400);
	private readonly textures: TextureLibrary;
	private readonly materials: MaterialLibrary;
	private readonly kit: ModelKit;
	private readonly post: PostEffects;
	private readonly motes = new AmbientMotes(0.5);
	private readonly sky: THREE.ShaderMaterial;
	private readonly observer: ResizeObserver;
	private readonly walkers: Walker[] = [];
	private readonly bats: Bat[] = [];
	private readonly mist: THREE.Sprite[] = [];
	private readonly doors: THREE.Object3D[] = [];
	private readonly doorLight = new THREE.PointLight(DOOR_LIGHT_COLOR, 12, 9, 2);
	private readonly ownedTextures: THREE.Texture[] = [];
	private readonly glowTexture: THREE.Texture;
	private readonly mystic: MysticDecor;
	private progress = 0;
	private loaded = false;
	private groupAdvance = 0;
	private positioned = false;
	private started = performance.now();
	private doorOpen = 0;
	private arrivedFor = 0;
	private shadowsBaked = false;
	private time = 0;
	private frame = 0;
	private last = performance.now();
	private disposed = false;
	onFirstFrame: (() => void) | null = null;
	onArrived: (() => void) | null = null;

	static prefetch(): void {
		const ignore = () => undefined;

		modelLibrary.require(MODELS).catch(ignore);
		preloadSpecialTextures().catch(ignore);

		const files = [
			...SCENE_SURFACES.flatMap((key) => surfaceFiles(key, true)),
			...reflectionFiles(),
		];

		for (const file of files) {
			loadImage(file).catch(ignore);
		}
	}

	static async create(
		host: HTMLElement,
		walkers: ApproachWalker[],
	): Promise<ManorApproachScene> {
		await modelLibrary.require(MODELS, undefined, true);
		await preloadSpecialTextures(true);

		return new ManorApproachScene(host, walkers);
	}

	private constructor(
		private readonly host: HTMLElement,
		walkers: ApproachWalker[],
	) {
		const settings = settingsStore.get();

		this.textures = new TextureLibrary(2, surfaceQuality("low"), true);
		this.materials = new MaterialLibrary(this.textures);
		this.kit = new ModelKit(this.materials);

		this.renderer = new THREE.WebGLRenderer({
			antialias: false,
			powerPreference: "high-performance",
		});

		this.renderer.setPixelRatio(pixelRatio());

		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.shadowMap.enabled = settings.shadows;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.shadowMap.autoUpdate = false;

		host.appendChild(this.renderer.domElement);

		this.post = new PostEffects(this.renderer, 0);

		this.glowTexture = this.ownTexture(softDotTexture());
		this.scene.background = new THREE.Color(NIGHT_COLOR);
		this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.017);
		this.sky = skyMaterial();

		const dome = new THREE.Mesh(
			new THREE.SphereGeometry(SKY_RADIUS, 32, 16),
			this.sky,
		);

		dome.frustumCulled = false;
		dome.renderOrder = -1;

		this.scene.add(dome);
		this.addMoons();
		this.addLights(settings.quality);
		this.addManor();

		this.mystic = this.addGrounds();

		this.addBats();
		this.addWalkers(walkers);
		this.scene.add(this.motes.points);

		this.observer = new ResizeObserver(() => this.resize());

		this.observer.observe(host);
		this.resize();

		void this.textures
			.settled()
			.then(() =>
				this.disposed ? undefined : this.compile().catch(() => undefined),
			)
			.then(() => this.uploadTextures())
			.then(() => {
				if (!this.disposed) {
					this.last = performance.now();
					this.started = this.last;
					this.frame = requestAnimationFrame(this.loop);
				}
			});
	}

	private ownTexture<T extends THREE.Texture>(texture: T): T {
		this.ownedTextures.push(texture);

		return texture;
	}

	private async compile(): Promise<void> {
		const previous = this.renderer.getRenderTarget();
		let scene: Promise<unknown>;

		this.renderer.setRenderTarget(this.post.sceneTarget);

		try {
			scene = this.renderer.compileAsync(this.scene, this.camera);
		} finally {
			this.renderer.setRenderTarget(previous);
		}

		await Promise.race([
			Promise.all([scene, this.post.compile()]),
			new Promise((resolve) => window.setTimeout(resolve, COMPILE_TIMEOUT_MS)),
		]);
	}

	private async uploadTextures(): Promise<void> {
		const textures = new Set<THREE.Texture>();

		this.scene.traverse((object) => {
			if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) {
				return;
			}

			const materials = Array.isArray(object.material)
				? object.material
				: [object.material];

			for (const material of materials) {
				for (const value of Object.values(material)) {
					if (value instanceof THREE.Texture) {
						textures.add(value);
					}
				}
			}
		});

		const pending = [...textures];

		while (pending.length > 0 && !this.disposed) {
			for (const texture of pending.splice(0, TEXTURE_UPLOADS_PER_FRAME)) {
				this.renderer.initTexture(texture);
			}

			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => resolve()),
			);
		}
	}

	setProgress(fraction: number, loaded: boolean): void {
		this.progress = Math.min(1, Math.max(0, fraction));
		this.loaded = loaded;

		if (this.positioned) {
			return;
		}

		this.positioned = true;
		this.groupAdvance = Math.max(0, this.targetAdvance() - ENTRY_RUN);

		for (const walker of this.walkers) {
			walker.advance = this.groupAdvance - walker.row * ROW_GAP;
		}
	}

	private addMoons(): void {
		const texture = this.ownTexture(moonTexture());

		const moon = new THREE.Mesh(
			new THREE.CircleGeometry(4.2, 40),
			new THREE.MeshBasicMaterial({
				map: texture,
				fog: false,
				toneMapped: false,
			}),
		);

		moon.position.copy(MOON_DIRECTION).multiplyScalar(SKY_RADIUS * 0.85);
		moon.lookAt(0, 0, 0);

		moon.renderOrder = 0;

		const secondMoon = new THREE.Mesh(
			new THREE.CircleGeometry(1.6, 32),
			new THREE.MeshBasicMaterial({
				map: texture,
				color: 0x9affd8,
				fog: false,
				toneMapped: false,
			}),
		);

		secondMoon.position
			.copy(SECOND_MOON_DIRECTION)
			.multiplyScalar(SKY_RADIUS * 0.85);

		secondMoon.lookAt(0, 0, 0);
		this.scene.add(moon, secondMoon);
	}

	private addLights(quality: keyof typeof QUALITY_PRESETS): void {
		const moon = new THREE.DirectionalLight(0xb4a4ff, 3.2);
		const size = Math.min(2048, QUALITY_PRESETS[quality].shadowMapSize * 2);

		this.scene.add(new THREE.HemisphereLight(0x7a68d0, 0x1e1824, 1.9));
		moon.position.copy(MOON_LIGHT_FROM);
		moon.target.position.set(0, 0, -14);

		moon.castShadow = true;

		moon.shadow.mapSize.set(size, size);

		moon.shadow.camera.left = -30;
		moon.shadow.camera.right = 30;
		moon.shadow.camera.top = 30;
		moon.shadow.camera.bottom = -30;
		moon.shadow.camera.near = 1;
		moon.shadow.camera.far = 110;
		moon.shadow.bias = -0.002;
		moon.shadow.normalBias = 0.06;

		this.scene.add(moon, moon.target);
		this.doorLight.position.set(0, 2.1, TOWER_FRONT_Z + 1.2);
		this.scene.add(this.doorLight);
	}

	private addManor(): void {
		const manor = buildManor(this.materials, this.kit);

		this.scene.add(manor.walls, manor.details, ...manor.doors, ...manor.lamps);
		this.doors.push(...manor.doors);
	}

	private addGrounds(): MysticDecor {
		const grounds = buildGrounds(
			this.materials,
			this.kit,
			this.ownTexture(softDotTexture(0.4)),
		);

		const mystic = new MysticDecor(
			this.materials,
			this.glowTexture,
			grounds.glowSpots,
		);

		this.scene.add(...grounds.statics, ...grounds.gates, ...grounds.mist);
		this.scene.add(mystic.root);
		this.mist.push(...grounds.mist);

		return mystic;
	}

	private addBats(): void {
		const material = new THREE.MeshBasicMaterial({
			color: 0x07070b,
			side: THREE.DoubleSide,
			fog: true,
		});

		const wing = new THREE.BufferGeometry();
		const rng = new SeededRandom(99);

		wing.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(
				[0, 0, 0.08, 0, 0, -0.08, 0.42, 0.05, -0.12, 0.3, 0, 0.1],
				3,
			),
		);

		wing.setIndex([0, 1, 2, 0, 2, 3]);
		wing.computeVertexNormals();

		for (let index = 0; index < BAT_COUNT; index += 1) {
			const root = new THREE.Group();

			const wings = [1, -1].map((side) => {
				const mesh = new THREE.Mesh(wing, material);

				mesh.scale.x = side;

				root.add(mesh);

				return mesh;
			});

			const body = new THREE.Mesh(
				new THREE.SphereGeometry(0.06, 6, 4),
				material,
			);

			body.scale.z = 1.8;

			root.add(body);
			this.scene.add(root);

			this.bats.push({
				root,
				wings,
				radius: rng.range(4.5, 8),
				height: rng.range(-2.5, 2.5),
				speed: rng.range(0.35, 0.6) * (rng.chance(0.5) ? 1 : -1),
				phase: rng.range(0, Math.PI * 2),
			});
		}
	}

	private addWalkers(walkers: ApproachWalker[]): void {
		const columns = Math.min(3, Math.max(1, walkers.length));
		const blobGeometry = new THREE.CircleGeometry(0.42, 20);

		const blobMaterial = new THREE.MeshBasicMaterial({
			map: this.glowTexture,
			color: 0x000000,
			transparent: true,
			opacity: 0.55,
			depthWrite: false,
		});

		for (const [index, walker] of walkers.entries()) {
			const tint = lanternColor(walker.lantern);

			const model = new MushroomModel(
				this.kit,
				walker.color,
				walker.pattern,
				tint,
			);

			const row = Math.floor(index / columns);
			const inRow = Math.min(columns, walkers.length - row * columns);
			const column = (index % columns) - (inRow - 1) / 2;
			const shadow = new THREE.Mesh(blobGeometry, blobMaterial);
			let light: THREE.PointLight | null = null;

			if (index < MAX_LANTERN_LIGHTS) {
				light = new THREE.PointLight(tint ?? DEFAULT_LANTERN_LIGHT, 3.2, 6, 2);

				this.scene.add(light);
			}

			shadow.rotation.x = -Math.PI / 2;
			shadow.renderOrder = 1;

			this.scene.add(model.root, shadow);

			this.walkers.push({
				model,
				shadow,
				light,
				column,
				row,
				jitter: (index * 0.37) % 1,
				advance: -row * ROW_GAP,
				gaze: 0,
			});
		}
	}

	private resize(): void {
		const width = this.host.clientWidth || window.innerWidth;
		const height = this.host.clientHeight || window.innerHeight;

		this.renderer.setSize(width, height, false);

		this.renderer.domElement.style.width = "100%";
		this.renderer.domElement.style.height = "100%";
		this.camera.aspect = width / Math.max(1, height);

		this.camera.updateProjectionMatrix();
	}

	private targetAdvance(): number {
		if (this.loaded) {
			return PATH_LENGTH;
		}

		const eased = 1 - (1 - this.progress) ** 1.6;

		return PATH_LENGTH * LOADING_REACH * eased;
	}

	private advanceGroup(step: number): number {
		const target = this.targetAdvance();
		const gap = target - this.groupAdvance;
		const topSpeed = this.loaded ? RUSH_SPEED : WALK_SPEED;

		const catchUp = this.loaded
			? Math.max(ARRIVAL_PACE, gap * ARRIVAL_GAIN)
			: Math.max(MIN_PACE, gap * LOADING_GAIN);

		const pace = gap <= 0 ? 0 : Math.min(topSpeed, catchUp);

		this.groupAdvance = Math.min(target, this.groupAdvance + pace * step);

		return topSpeed;
	}

	private updateDoors(step: number): void {
		const opening = this.loaded && PATH_LENGTH - this.groupAdvance < DOOR_REACH;

		const arrived =
			this.loaded &&
			this.groupAdvance >= PATH_LENGTH - 0.01 &&
			this.doorOpen >= 1;

		this.doorOpen = Math.min(
			1,
			Math.max(0, this.doorOpen + ((opening ? 1 : -1) * step) / DOOR_OPEN_S),
		);

		this.arrivedFor = arrived ? this.arrivedFor + step : 0;

		if (this.arrivedFor >= ARRIVAL_PAUSE_S && this.onArrived) {
			const done = this.onArrived;

			this.onArrived = null;

			done();
		}

		const swing = 1 - (1 - this.doorOpen) ** 3;

		for (const door of this.doors) {
			door.rotation.y = (door.userData.side as number) * swing * 1.45;
		}

		this.doorLight.intensity =
			12 +
			swing * 36 +
			Math.sin(this.time * 9) * 0.35 +
			Math.sin(this.time * 23) * 0.2;

		this.doorLight.distance = 9 + swing * 5;
	}

	private updateWalkers(step: number, dt: number, topSpeed: number): void {
		for (const walker of this.walkers) {
			const target = this.groupAdvance - walker.row * ROW_GAP;
			const behind = target - walker.advance;
			const speed = Math.min(topSpeed * 1.15, Math.max(0, behind) * 2.5);

			walker.advance += speed * step;

			const z = START_Z - walker.advance;
			const sway = Math.sin(this.time * 0.6 + walker.jitter * 6) * 0.12;
			const x = walker.column * COLUMN_GAP + sway;
			const idle = speed < 0.05;

			const wantedGaze = idle
				? Math.sin(this.time * 0.4 + walker.jitter * 9) * 0.5
				: 0;

			walker.model.root.position.set(x, 0, z);
			walker.shadow.position.set(x, 0.07, z);

			walker.gaze += (wantedGaze - walker.gaze) * Math.min(1, dt * 2);
			walker.model.root.rotation.y = modelYaw(walker.gaze + sway * 0.4);

			walker.model.update(dt, {
				speed,
				crouch: 0,
				grounded: true,
				sprinting: speed > SPRINT_FROM,
				lanternOpen: true,
				grimoireOpen: false,
				dead: false,
				talking: 0,
			});

			if (walker.light) {
				walker.model.root.updateMatrixWorld(true);
				walker.light.position.copy(walker.model.lanternLightPosition);

				walker.light.intensity =
					3 + Math.sin(this.time * 17 + walker.jitter * 20) * 0.3;
			}
		}
	}

	private updateBats(): void {
		for (const bat of this.bats) {
			const angle = bat.phase + this.time * bat.speed;
			const flap = Math.sin(this.time * 16 + bat.phase) * 0.7;

			bat.root.position.set(
				TOWER_TOP.x + Math.cos(angle) * bat.radius,
				TOWER_TOP.y + bat.height + Math.sin(this.time * 1.3 + bat.phase) * 0.6,
				TOWER_TOP.z + Math.sin(angle) * bat.radius,
			);

			bat.root.rotation.y = -angle + (bat.speed > 0 ? 0 : Math.PI);
			bat.wings[0].rotation.z = flap;
			bat.wings[1].rotation.z = -flap;
		}
	}

	private updateMist(dt: number): void {
		for (const sprite of this.mist) {
			sprite.position.x += (sprite.userData.drift as number) * dt;

			if (sprite.position.x > 24) {
				sprite.position.x = -24;
			} else if (sprite.position.x < -24) {
				sprite.position.x = 24;
			}
		}
	}

	private updateCamera(animated: boolean): void {
		const leadZ = START_Z - this.groupAdvance;

		const rows =
			this.walkers.length === 0
				? 0
				: Math.max(...this.walkers.map(({ row }) => row));

		const climb = this.groupAdvance / PATH_LENGTH;
		const pitch = PITCH_START + (PITCH_END - PITCH_START) * climb;

		this.camera.position.set(
			0.6 + (animated ? Math.sin(this.time * 0.13) * 0.2 : 0),
			0.45 + (animated ? Math.sin(this.time * 0.9) * 0.015 : 0),
			leadZ + 6.8 + rows * ROW_GAP,
		);

		this.camera.lookAt(
			this.camera.position.x - 0.5,
			this.camera.position.y + Math.tan(pitch) * LOOK_DISTANCE,
			this.camera.position.z - LOOK_DISTANCE,
		);
	}

	private readonly loop = (now: number) => {
		this.frame = requestAnimationFrame(this.loop);

		const step = Math.min(MAX_MOVE_STEP_S, (now - this.last) / 1000);
		const dt = Math.min(MAX_ANIMATION_STEP_S, step);
		const animated = !settingsStore.get().reduceMotion;

		this.last = now;
		this.time += step;

		const topSpeed = this.advanceGroup(step);

		this.updateDoors(step);
		this.updateWalkers(step, dt, topSpeed);
		this.updateBats();
		this.updateMist(dt);
		this.mystic.update(this.time, animated);
		this.updateCamera(animated);

		this.sky.uniforms.time.value = this.time;

		this.renderer.toneMappingExposure =
			Math.min(1, (now - this.started) / 1200) * 0.95;

		this.motes.update(dt, this.camera.position);

		const ratio = pixelRatio();

		if (this.renderer.getPixelRatio() !== ratio) {
			this.renderer.setPixelRatio(ratio);
		}

		if (!this.shadowsBaked) {
			this.shadowsBaked = true;
			this.renderer.shadowMap.needsUpdate = true;
		}

		this.post.render({ dt, tension: 0.15, animated, camera: this.camera }, () =>
			this.renderer.render(this.scene, this.camera),
		);

		if (this.onFirstFrame) {
			const done = this.onFirstFrame;

			this.onFirstFrame = null;

			done();
		}
	};

	dispose(): void {
		this.disposed = true;

		cancelAnimationFrame(this.frame);
		this.observer.disconnect();

		for (const walker of this.walkers) {
			walker.model.dispose();
		}

		this.motes.dispose();
		this.mystic.dispose();

		this.scene.traverse((object) => {
			if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
				object.geometry.dispose();
			}
		});

		for (const texture of this.ownedTextures) {
			texture.dispose();
		}

		this.sky.dispose();
		this.materials.dispose();
		this.textures.dispose();
		this.post.dispose();
		this.renderer.dispose();
		this.renderer.forceContextLoss();
		this.renderer.domElement.remove();
	}
}
