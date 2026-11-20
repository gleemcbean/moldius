import type { HatPattern } from "@shared/hatPatterns";
import { SeededRandom } from "@shared/random";
import {
	DEFAULT_LANTERN_TINT,
	LANTERN_TINT_COLORS,
	type LanternTint,
} from "@shared/rewards";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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
import {
	meterBox,
	meterCylinder,
	meterTorus,
	placed,
	scaleUv,
} from "../world/geometryUtils";
import {
	MaterialLibrary,
	type MaterialOptions,
} from "../world/MaterialLibrary";
import { TextureLibrary } from "../world/textures/TextureLibrary";
import {
	loadImage,
	preloadSpecialTextures,
	reflectionFiles,
	surfaceFiles,
} from "../world/textures/textureFiles";

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

const FACADE_Z = -26;
const TOWER_FRONT_Z = -23;
const START_Z = 5;
const PORCH_Z = -20.6;
const PATH_LENGTH = START_Z - PORCH_Z;
const GATE_Z = 2;
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
const MOON_DIRECTION = new THREE.Vector3(0.36, 0.4, -1).normalize();
const MOON_LIGHT_FROM = new THREE.Vector3(24, 30, 16);
const SKY_RADIUS = 160;
const PITCH_START = THREE.MathUtils.degToRad(12);
const PITCH_END = THREE.MathUtils.degToRad(19);
const LOOK_DISTANCE = 20;
const TOWER_TOP = new THREE.Vector3(0, 19.5, -25.5);

const STONE: MaterialOptions = { texture: "stoneBlocks", color: 0xc4c9d6 };
const TRIM: MaterialOptions = { texture: "stoneSmooth", color: 0xaab0be };
const ROOF: MaterialOptions = { texture: "slate", color: 0x8c94a8 };
const LIT_GLASS: MaterialOptions = { color: 0xffb25a, unlit: true };
const DARK_GLASS: MaterialOptions = { color: 0x111725, roughness: 0.3 };
const MULLION: MaterialOptions = { color: 0x1c1f26, roughness: 0.7 };
const DOOR_WOOD: MaterialOptions = { texture: "darkPlanks", color: 0xa87a54 };
const PATH: MaterialOptions = { texture: "cobble", color: 0xb4b2ae };
const LAWN: MaterialOptions = { texture: "soil", color: 0x7c8c6c };
const IRON: MaterialOptions = { texture: "iron", color: 0x2e3138 };
const BARK: MaterialOptions = { texture: "bark", color: 0x6e6358 };
const GRAVE: MaterialOptions = { texture: "granite", color: 0xb8bcc6 };
const GLOW: MaterialOptions = { color: 0xffa650, unlit: true };
const SCENE_SURFACES = [
	STONE,
	TRIM,
	ROOF,
	DOOR_WOOD,
	PATH,
	LAWN,
	IRON,
	BARK,
	GRAVE,
].flatMap(({ texture }) => (texture ? [texture] : []));

function pixelRatio(): number {
	const { quality, renderScale } = settingsStore.get();
	return Math.min(MAX_PIXEL_RATIO, renderPixelRatio(quality, renderScale));
}

function blobTexture(): THREE.CanvasTexture {
	const size = 64;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
	gradient.addColorStop(0, "rgba(255,255,255,1)");
	gradient.addColorStop(0.6, "rgba(255,255,255,0.6)");
	gradient.addColorStop(1, "rgba(255,255,255,0)");
	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);
	return new THREE.CanvasTexture(canvas);
}

function lanternColor(tint: LanternTint): number | null {
	return tint === DEFAULT_LANTERN_TINT ? null : LANTERN_TINT_COLORS[tint];
}

class Batch {
	private readonly parts = new Map<
		string,
		{ options: MaterialOptions; geometries: THREE.BufferGeometry[] }
	>();

	add(options: MaterialOptions, geometry: THREE.BufferGeometry): void {
		const key = JSON.stringify(options);
		const entry = this.parts.get(key) ?? { options, geometries: [] };
		entry.geometries.push(geometry);
		this.parts.set(key, entry);
	}

	build(
		materials: MaterialLibrary,
		cast: boolean,
		receive: boolean,
	): THREE.Group {
		const group = new THREE.Group();
		for (const { options, geometries } of this.parts.values()) {
			const merged = mergeGeometries(geometries, false);
			for (const geometry of geometries) {
				geometry.dispose();
			}
			if (!merged) {
				continue;
			}
			const mesh = new THREE.Mesh(merged, materials.get(options));
			mesh.castShadow = cast && !options.unlit;
			mesh.receiveShadow = receive && !options.unlit;
			group.add(mesh);
		}
		return group;
	}
}

function box(
	width: number,
	height: number,
	depth: number,
	x: number,
	y: number,
	z: number,
	rotationY = 0,
	rotationX = 0,
	rotationZ = 0,
): THREE.BufferGeometry {
	return placed(
		meterBox(width, height, depth),
		x,
		y,
		z,
		rotationY,
		rotationX,
		rotationZ,
	);
}

function pyramid(
	halfWidth: number,
	halfDepth: number,
	height: number,
	x: number,
	y: number,
	z: number,
): THREE.BufferGeometry {
	const geometry = meterCylinder(0, 1, height, 4);
	geometry.rotateY(Math.PI / 4);
	geometry.scale(halfWidth / Math.SQRT1_2, 1, halfDepth / Math.SQRT1_2);
	return placed(geometry, x, y, z);
}

function gable(
	width: number,
	height: number,
	x: number,
	y: number,
	z: number,
	rotationY: number,
): THREE.BufferGeometry {
	const shape = new THREE.Shape();
	shape.moveTo(-width / 2, 0);
	shape.lineTo(width / 2, 0);
	shape.lineTo(0, height);
	shape.closePath();
	return placed(new THREE.ShapeGeometry(shape), x, y, z, rotationY);
}

function halfDisc(radius: number): THREE.BufferGeometry {
	return scaleUv(
		new THREE.CircleGeometry(radius, 16, 0, Math.PI),
		radius * 2,
		radius * 2,
	);
}

function segment(
	from: THREE.Vector3,
	to: THREE.Vector3,
	radiusFrom: number,
	radiusTo: number,
): THREE.BufferGeometry {
	const direction = to.clone().sub(from);
	const length = direction.length();
	const geometry = meterCylinder(radiusTo, radiusFrom, length, 6);
	geometry.translate(0, length / 2, 0);
	geometry.applyQuaternion(
		new THREE.Quaternion().setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			direction.normalize(),
		),
	);
	geometry.translate(from.x, from.y, from.z);
	return geometry;
}

function roof(
	batch: Batch,
	width: number,
	depth: number,
	rise: number,
	eaveY: number,
	centerZ: number,
	overhang: number,
): void {
	const run = depth / 2 + overhang;
	const angle = Math.atan2(rise, depth / 2);
	const drop = run * Math.tan(angle);
	for (const side of [1, -1]) {
		batch.add(
			ROOF,
			box(
				width + overhang * 2,
				0.28,
				run / Math.cos(angle),
				0,
				eaveY + rise - drop / 2,
				centerZ + (side * run) / 2,
				0,
				side * angle,
			),
		);
	}
}

function windowAt(
	batch: Batch,
	x: number,
	y: number,
	z: number,
	width: number,
	height: number,
	lit: boolean,
	rotationY = 0,
): void {
	const glass = lit ? LIT_GLASS : DARK_GLASS;
	const pane = new THREE.PlaneGeometry(width, height);
	scaleUv(pane, width, height);
	const arch = halfDisc(width / 2).translate(0, height / 2, 0);
	const outward = new THREE.Vector3(
		Math.sin(rotationY),
		0,
		Math.cos(rotationY),
	);
	const at = (forward: number) => ({
		x: x + outward.x * forward,
		z: z + outward.z * forward,
	});
	const glassAt = at(0.02);
	batch.add(glass, placed(pane, glassAt.x, y, glassAt.z, rotationY));
	batch.add(glass, placed(arch, glassAt.x, y, glassAt.z, rotationY));
	const barAt = at(0.05);
	batch.add(
		MULLION,
		box(
			0.07,
			height + width / 2,
			0.04,
			barAt.x,
			y + width / 4,
			barAt.z,
			rotationY,
		),
	);
	batch.add(
		MULLION,
		box(width, 0.07, 0.04, barAt.x, y + height * 0.12, barAt.z, rotationY),
	);
	const sillAt = at(0.12);
	batch.add(
		TRIM,
		box(
			width + 0.36,
			0.16,
			0.26,
			sillAt.x,
			y - height / 2 - 0.08,
			sillAt.z,
			rotationY,
		),
	);
	const archRing = meterTorus(width / 2 + 0.1, 0.09, 4, 12, Math.PI);
	const ringAt = at(0.06);
	batch.add(
		TRIM,
		placed(archRing, ringAt.x, y + height / 2, ringAt.z, rotationY),
	);
	for (const side of [-1, 1]) {
		const jamb = at(0.06);
		const offset = side * (width / 2 + 0.1);
		batch.add(
			TRIM,
			box(
				0.18,
				height,
				0.14,
				jamb.x + Math.cos(rotationY) * offset,
				y,
				jamb.z - Math.sin(rotationY) * offset,
				rotationY,
			),
		);
	}
}

function deadTree(
	batch: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
	height: number,
): void {
	const grow = (
		from: THREE.Vector3,
		direction: THREE.Vector3,
		length: number,
		radius: number,
		depth: number,
	) => {
		const to = from.clone().addScaledVector(direction, length);
		batch.add(BARK, segment(from, to, radius, radius * 0.62));
		if (depth === 0) {
			return;
		}
		const children = depth === 3 ? 3 : rng.int(2, 3);
		for (let index = 0; index < children; index += 1) {
			const azimuth = rng.range(0, Math.PI * 2);
			const tilt = rng.range(0.35, 0.85);
			const side = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
			const next = direction
				.clone()
				.multiplyScalar(Math.cos(tilt))
				.addScaledVector(side, Math.sin(tilt))
				.normalize();
			const start = from.clone().lerp(to, rng.range(0.55, 1));
			grow(start, next, length * rng.range(0.5, 0.7), radius * 0.6, depth - 1);
		}
	};
	const lean = new THREE.Vector3(
		rng.range(-0.15, 0.15),
		1,
		rng.range(-0.15, 0.15),
	).normalize();
	grow(new THREE.Vector3(x, -0.2, z), lean, height * 0.55, height * 0.06, 3);
}

function tombstone(
	batch: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
): void {
	const width = rng.range(0.5, 0.75);
	const height = rng.range(0.55, 0.9);
	const tilt = rng.range(-0.12, 0.12);
	const turn = rng.range(-0.25, 0.25);
	const slab = meterBox(width, height, 0.14).translate(0, height / 2, 0);
	const top = new THREE.CylinderGeometry(
		width / 2,
		width / 2,
		0.14,
		12,
		1,
		false,
		0,
		Math.PI,
	);
	scaleUv(top, width * 1.6, 0.14);
	top
		.rotateX(Math.PI / 2)
		.rotateZ(Math.PI / 2)
		.translate(0, height, 0);
	for (const geometry of [slab, top]) {
		batch.add(GRAVE, placed(geometry, x, -0.05, z, turn, 0, tilt));
	}
}

function skyMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		side: THREE.BackSide,
		depthWrite: false,
		fog: false,
		uniforms: {
			moonDirection: { value: MOON_DIRECTION.clone() },
			time: { value: 0 },
		},
		vertexShader: `
varying vec3 vDirection;
void main() {
	vDirection = position;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
		fragmentShader: `
uniform vec3 moonDirection;
uniform float time;
varying vec3 vDirection;
float starHash(vec3 point) {
	point = fract(point * 0.3183099 + 0.1);
	point *= 17.0;
	return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
}
void main() {
	vec3 direction = normalize(vDirection);
	float height = clamp(direction.y, -0.2, 1.0);
	vec3 horizon = vec3(0.105, 0.13, 0.23);
	vec3 zenith = vec3(0.01, 0.016, 0.045);
	vec3 color = mix(horizon, zenith, pow(max(height, 0.0), 0.5));
	float moon = max(dot(direction, moonDirection), 0.0);
	color += vec3(0.5, 0.58, 0.78) * (pow(moon, 80.0) * 0.45 + pow(moon, 9.0) * 0.12);
	float seed = starHash(floor(direction * 300.0));
	float twinkle = 0.65 + 0.35 * sin(time * 1.7 + seed * 80.0);
	float star = step(0.9968, seed) * smoothstep(0.02, 0.3, height) * twinkle;
	color += vec3(0.85, 0.9, 1.0) * star * (1.0 - smoothstep(0.9, 0.99, moon));
	gl_FragColor = vec4(color, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
	});
}

function moonTexture(): THREE.CanvasTexture {
	const size = 128;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	const gradient = context.createRadialGradient(54, 50, 6, 64, 64, 62);
	gradient.addColorStop(0, "#fffdf2");
	gradient.addColorStop(0.85, "#e9e6d6");
	gradient.addColorStop(1, "#c9c7bc");
	context.fillStyle = gradient;
	context.beginPath();
	context.arc(64, 64, 62, 0, Math.PI * 2);
	context.fill();
	const rng = new SeededRandom(7);
	for (let index = 0; index < 14; index += 1) {
		context.fillStyle = `rgba(150, 150, 140, ${rng.range(0.12, 0.3).toFixed(2)})`;
		context.beginPath();
		const angle = rng.range(0, Math.PI * 2);
		const distance = rng.range(0, 44);
		context.arc(
			64 + Math.cos(angle) * distance,
			64 + Math.sin(angle) * distance,
			rng.range(3, 12),
			0,
			Math.PI * 2,
		);
		context.fill();
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

function mistTexture(): THREE.CanvasTexture {
	const size = 64;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
	gradient.addColorStop(0, "rgba(255,255,255,1)");
	gradient.addColorStop(1, "rgba(255,255,255,0)");
	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);
	return new THREE.CanvasTexture(canvas);
}

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
	private readonly doorLight = new THREE.PointLight(0xffa04a, 12, 9, 2);
	private readonly ownedTextures: THREE.Texture[] = [];
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

		this.scene.background = new THREE.Color(0x0a0e1c);
		this.scene.fog = new THREE.FogExp2(0x121a2e, 0.017);
		this.sky = skyMaterial();
		const dome = new THREE.Mesh(
			new THREE.SphereGeometry(SKY_RADIUS, 32, 16),
			this.sky,
		);
		dome.frustumCulled = false;
		dome.renderOrder = -1;
		this.scene.add(dome);
		this.addMoon();
		this.addLights(settings.quality);
		this.addManor();
		this.addGrounds();
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

	private async compile(): Promise<void> {
		const previous = this.renderer.getRenderTarget();
		this.renderer.setRenderTarget(this.post.sceneTarget);
		let scene: Promise<unknown>;
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
		if (!this.positioned) {
			this.positioned = true;
			this.groupAdvance = Math.max(0, this.targetAdvance() - ENTRY_RUN);
			for (const walker of this.walkers) {
				walker.advance = this.groupAdvance - walker.row * ROW_GAP;
			}
		}
	}

	private addMoon(): void {
		const texture = moonTexture();
		this.ownedTextures.push(texture);
		const disc = new THREE.Mesh(
			new THREE.CircleGeometry(4.2, 40),
			new THREE.MeshBasicMaterial({
				map: texture,
				fog: false,
				toneMapped: false,
			}),
		);
		disc.position.copy(MOON_DIRECTION).multiplyScalar(SKY_RADIUS * 0.85);
		disc.lookAt(0, 0, 0);
		disc.renderOrder = 0;
		this.scene.add(disc);
	}

	private addLights(quality: keyof typeof QUALITY_PRESETS): void {
		this.scene.add(new THREE.HemisphereLight(0x6a80c0, 0x221e1a, 1.9));
		const moon = new THREE.DirectionalLight(0xa9bcff, 3.4);
		moon.position.copy(MOON_LIGHT_FROM);
		moon.target.position.set(0, 0, -14);
		moon.castShadow = true;
		const size = Math.min(2048, QUALITY_PRESETS[quality].shadowMapSize * 2);
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
		const rng = new SeededRandom(1847);
		const walls = new Batch();
		const details = new Batch();
		const mainDepth = 10;
		const mainZ = FACADE_Z - mainDepth / 2;
		walls.add(STONE, box(18, 10, mainDepth, 0, 5, mainZ));
		walls.add(TRIM, box(18.4, 0.8, mainDepth + 0.4, 0, 0.4, mainZ));
		walls.add(TRIM, box(18.5, 0.35, mainDepth + 0.5, 0, 9.9, mainZ));
		roof(walls, 18, mainDepth, 4.6, 10, mainZ, 0.6);
		for (const side of [-1, 1]) {
			walls.add(
				STONE,
				gable(mainDepth, 4.6, side * 9, 10, mainZ, side * (Math.PI / 2)),
			);
			const wingX = side * 13;
			const wingZ = mainZ - 1;
			walls.add(STONE, box(8, 7.5, 8, wingX, 3.75, wingZ));
			walls.add(TRIM, box(8.4, 0.7, 8.4, wingX, 0.35, wingZ));
			walls.add(TRIM, box(8.5, 0.3, 8.5, wingX, 7.4, wingZ));
			walls.add(ROOF, pyramid(4.6, 4.6, 3.6, wingX, 7.5 + 1.8, wingZ));
			const turretX = side * 9;
			walls.add(
				STONE,
				placed(meterCylinder(1.5, 1.6, 13, 14), turretX, 6.5, FACADE_Z),
			);
			walls.add(
				TRIM,
				placed(meterCylinder(1.8, 1.8, 0.35, 14), turretX, 13, FACADE_Z),
			);
			walls.add(
				ROOF,
				placed(meterCylinder(0, 1.95, 5.2, 14), turretX, 13 + 2.6, FACADE_Z),
			);
			details.add(
				IRON,
				placed(meterCylinder(0.03, 0.05, 1.2, 6), turretX, 18.7, FACADE_Z),
			);
			walls.add(STONE, box(1.1, 3.6, 1.1, side * 5.5, 13.4, mainZ - 1.5));
			walls.add(TRIM, box(1.4, 0.3, 1.4, side * 5.5, 15.3, mainZ - 1.5));
			for (const row of [2.4, 6.4]) {
				for (const x of [4.2, 6.5]) {
					windowAt(
						details,
						side * x,
						row,
						FACADE_Z,
						1.05,
						1.9,
						rng.chance(0.55),
					);
				}
			}
			for (const row of [2.3, 5.2]) {
				for (const x of [11.2, 14.8]) {
					windowAt(
						details,
						side * x,
						row,
						wingZ + 4,
						1.0,
						1.7,
						rng.chance(0.45),
					);
				}
			}
			windowAt(details, turretX, 8.4, FACADE_Z + 1.62, 0.4, 1.1, side > 0);
		}
		const towerZ = TOWER_FRONT_Z - 2.5;
		walls.add(STONE, box(5, 18, 5, 0, 9, towerZ));
		walls.add(TRIM, box(5.4, 0.8, 5.4, 0, 0.4, towerZ));
		walls.add(TRIM, box(5.7, 0.45, 5.7, 0, 18, towerZ));
		walls.add(ROOF, pyramid(3.1, 3.1, 8, 0, 18 + 4, towerZ));
		details.add(IRON, placed(meterCylinder(0.04, 0.07, 2, 6), 0, 27, towerZ));
		windowAt(details, 0, 7.4, TOWER_FRONT_Z, 1.2, 2.2, true);
		windowAt(details, 0, 11.4, TOWER_FRONT_Z, 1.0, 1.8, false);
		const rose = new THREE.CircleGeometry(0.75, 20);
		scaleUv(rose, 1.5, 1.5);
		details.add(LIT_GLASS, placed(rose, 0, 15, TOWER_FRONT_Z + 0.02));
		details.add(
			TRIM,
			placed(meterTorus(0.8, 0.11, 4, 20), 0, 15, TOWER_FRONT_Z + 0.05),
		);

		details.add(TRIM, box(0.4, 3.2, 0.3, -1.2, 1.6, TOWER_FRONT_Z + 0.12));
		details.add(TRIM, box(0.4, 3.2, 0.3, 1.2, 1.6, TOWER_FRONT_Z + 0.12));
		details.add(
			TRIM,
			placed(
				meterTorus(1.2, 0.2, 6, 16, Math.PI),
				0,
				3.2,
				TOWER_FRONT_Z + 0.12,
			),
		);
		details.add(DOOR_WOOD, placed(halfDisc(1.0), 0, 3.2, TOWER_FRONT_Z + 0.04));
		const opening = new THREE.PlaneGeometry(2, 3.2);
		scaleUv(opening, 2, 3.2);
		details.add(GLOW, placed(opening, 0, 1.6, TOWER_FRONT_Z + 0.02));
		for (let step = 0; step < 3; step += 1) {
			const depth = 1.4 - step * 0.45;
			details.add(
				TRIM,
				box(
					3.8 - step * 0.45,
					0.18,
					depth,
					0,
					0.09 + step * 0.18,
					TOWER_FRONT_Z + depth / 2,
				),
			);
		}
		this.scene.add(walls.build(this.materials, true, false));
		this.scene.add(details.build(this.materials, false, true));

		for (const side of [-1, 1]) {
			const pivot = new THREE.Group();
			pivot.position.set(side * 1.0, 0, TOWER_FRONT_Z + 0.06);
			const leaf = new THREE.Mesh(
				meterBox(1.0, 3.2, 0.12),
				this.materials.get(DOOR_WOOD),
			);
			leaf.position.set(-side * 0.5, 1.6, 0);
			pivot.add(leaf);
			const ring = new THREE.Mesh(
				meterTorus(0.09, 0.02, 4, 10),
				this.materials.get(IRON),
			);
			ring.position.set(-side * 0.82, 1.4, 0.08);
			pivot.add(ring);
			pivot.userData.side = side;
			this.doors.push(pivot);
			this.scene.add(pivot);
			const lamp = fitted(this.kit.model("furniture/wallLantern"), 0.75);
			lamp.position.set(side * 1.85, 2.4, TOWER_FRONT_Z + 0.05);
			this.scene.add(lamp);
		}
	}

	private addGrounds(): void {
		const rng = new SeededRandom(2207);
		const ground = new Batch();
		const fence = new Batch();
		const lawn = new THREE.PlaneGeometry(240, 240);
		scaleUv(lawn, 240, 240);
		lawn.rotateX(-Math.PI / 2);
		ground.add(LAWN, lawn);
		const pathDepth = START_Z + 6 - TOWER_FRONT_Z;
		const pathZ = (START_Z + 6 + TOWER_FRONT_Z) / 2;
		ground.add(PATH, box(2.6, 0.06, pathDepth, 0, 0.03, pathZ));
		for (const side of [-1, 1]) {
			ground.add(TRIM, box(0.2, 0.12, pathDepth, side * 1.4, 0.06, pathZ));
		}
		this.scene.add(ground.build(this.materials, false, true));

		for (const side of [-1, 1]) {
			fence.add(TRIM, box(0.7, 2.4, 0.7, side * 1.9, 1.2, GATE_Z));
			fence.add(TRIM, box(0.9, 0.2, 0.9, side * 1.9, 2.5, GATE_Z));
			for (let x = 2.5; x < 26; x += 0.55) {
				fence.add(IRON, box(0.05, 1.5, 0.05, side * x, 0.75, GATE_Z));
				fence.add(
					IRON,
					placed(meterCylinder(0, 0.06, 0.2, 5), side * x, 1.6, GATE_Z),
				);
			}
			for (const height of [0.3, 1.3]) {
				fence.add(IRON, box(23.6, 0.06, 0.06, side * 14.2, height, GATE_Z));
			}
			const gate = new THREE.Group();
			for (let x = 0.15; x < 1.5; x += 0.22) {
				gate.add(
					new THREE.Mesh(
						meterBox(0.05, 1.9, 0.05).translate(-side * x, 0.95, 0),
						this.materials.get(IRON),
					),
				);
			}
			for (const height of [0.35, 1.6]) {
				gate.add(
					new THREE.Mesh(
						meterBox(1.5, 0.06, 0.06).translate(-side * 0.78, height, 0),
						this.materials.get(IRON),
					),
				);
			}
			gate.position.set(side * 1.55, 0, GATE_Z);
			gate.rotation.y = side * -1.5;
			this.scene.add(gate);
			const urn = fitted(this.kit.model("furniture/urn"), 0.8);
			urn.position.set(side * 1.9, 2.6, GATE_Z);
			this.scene.add(urn);
		}
		const trees: [number, number, number][] = [
			[-6.5, -5, 7],
			[7.5, -3, 6],
			[-15, -13, 9],
			[16, -16, 8.5],
			[-22, -22, 10],
			[23, -25, 9],
			[-4.6, 9, 9],
			[11, 7, 6],
		];
		for (const [x, z, height] of trees) {
			deadTree(fence, rng, x, z, height);
		}
		for (let index = 0; index < 7; index += 1) {
			tombstone(fence, rng, rng.range(-12, -5), rng.range(-15, -7));
		}
		for (let index = 0; index < 4; index += 1) {
			tombstone(fence, rng, rng.range(5, 10), rng.range(-12, -7));
		}
		this.scene.add(fence.build(this.materials, true, true));

		const texture = mistTexture();
		this.ownedTextures.push(texture);
		for (let index = 0; index < 14; index += 1) {
			const sprite = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: texture,
					color: 0x9db0d8,
					transparent: true,
					opacity: rng.range(0.07, 0.14),
					depthWrite: false,
				}),
			);
			const scale = rng.range(7, 14);
			sprite.scale.set(scale, scale * 0.35, 1);
			sprite.position.set(
				rng.range(-20, 20),
				rng.range(0.3, 1.1),
				rng.range(-24, 6),
			);
			sprite.userData.drift = rng.range(-0.25, 0.25);
			this.mist.push(sprite);
			this.scene.add(sprite);
		}
	}

	private addBats(): void {
		const material = new THREE.MeshBasicMaterial({
			color: 0x07070b,
			side: THREE.DoubleSide,
			fog: true,
		});
		const wing = new THREE.BufferGeometry();
		wing.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(
				[0, 0, 0.08, 0, 0, -0.08, 0.42, 0.05, -0.12, 0.3, 0, 0.1],
				3,
			),
		);
		wing.setIndex([0, 1, 2, 0, 2, 3]);
		wing.computeVertexNormals();
		const rng = new SeededRandom(99);
		for (let index = 0; index < 4; index += 1) {
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
		const blob = blobTexture();
		this.ownedTextures.push(blob);
		const blobGeometry = new THREE.CircleGeometry(0.42, 20);
		const blobMaterial = new THREE.MeshBasicMaterial({
			map: blob,
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
			let light: THREE.PointLight | null = null;
			if (index < MAX_LANTERN_LIGHTS) {
				light = new THREE.PointLight(tint ?? DEFAULT_LANTERN_LIGHT, 3.2, 6, 2);
				this.scene.add(light);
			}
			const shadow = new THREE.Mesh(blobGeometry, blobMaterial);
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

	private readonly loop = (now: number) => {
		this.frame = requestAnimationFrame(this.loop);
		const step = Math.min(MAX_MOVE_STEP_S, (now - this.last) / 1000);
		const dt = Math.min(MAX_ANIMATION_STEP_S, step);
		this.last = now;
		this.time += step;
		const settings = settingsStore.get();
		const animated = !settings.reduceMotion;

		const target = this.targetAdvance();
		const gap = target - this.groupAdvance;
		const topSpeed = this.loaded ? RUSH_SPEED : WALK_SPEED;
		const pace =
			gap <= 0
				? 0
				: Math.min(
						topSpeed,
						this.loaded
							? Math.max(ARRIVAL_PACE, gap * ARRIVAL_GAIN)
							: Math.max(MIN_PACE, gap * LOADING_GAIN),
					);
		this.groupAdvance = Math.min(target, this.groupAdvance + pace * step);
		const opening = this.loaded && PATH_LENGTH - this.groupAdvance < DOOR_REACH;
		this.doorOpen = Math.min(
			1,
			Math.max(0, this.doorOpen + ((opening ? 1 : -1) * step) / DOOR_OPEN_S),
		);
		const arrived =
			this.loaded &&
			this.groupAdvance >= PATH_LENGTH - 0.01 &&
			this.doorOpen >= 1;
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

		for (const walker of this.walkers) {
			const target = this.groupAdvance - walker.row * ROW_GAP;
			const behind = target - walker.advance;
			const speed = Math.min(topSpeed * 1.15, Math.max(0, behind) * 2.5);
			walker.advance += speed * step;
			const z = START_Z - walker.advance;
			const sway = Math.sin(this.time * 0.6 + walker.jitter * 6) * 0.12;
			const x = walker.column * COLUMN_GAP + sway;
			walker.model.root.position.set(x, 0, z);
			walker.shadow.position.set(x, 0.07, z);
			const idle = speed < 0.05;
			walker.gaze +=
				((idle ? Math.sin(this.time * 0.4 + walker.jitter * 9) * 0.5 : 0) -
					walker.gaze) *
				Math.min(1, dt * 2);
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

		for (const bat of this.bats) {
			const angle = bat.phase + this.time * bat.speed;
			bat.root.position.set(
				TOWER_TOP.x + Math.cos(angle) * bat.radius,
				TOWER_TOP.y + bat.height + Math.sin(this.time * 1.3 + bat.phase) * 0.6,
				TOWER_TOP.z + Math.sin(angle) * bat.radius,
			);
			bat.root.rotation.y = -angle + (bat.speed > 0 ? 0 : Math.PI);
			const flap = Math.sin(this.time * 16 + bat.phase) * 0.7;
			bat.wings[0].rotation.z = flap;
			bat.wings[1].rotation.z = -flap;
		}
		for (const sprite of this.mist) {
			sprite.position.x += (sprite.userData.drift as number) * dt;
			if (sprite.position.x > 24) {
				sprite.position.x = -24;
			} else if (sprite.position.x < -24) {
				sprite.position.x = 24;
			}
		}

		const leadZ = START_Z - this.groupAdvance;
		const rows =
			this.walkers.length === 0
				? 0
				: Math.max(...this.walkers.map(({ row }) => row));
		this.camera.position.set(
			0.6 + (animated ? Math.sin(this.time * 0.13) * 0.2 : 0),
			0.45 + (animated ? Math.sin(this.time * 0.9) * 0.015 : 0),
			leadZ + 6.8 + rows * ROW_GAP,
		);
		const climb = this.groupAdvance / PATH_LENGTH;
		const pitch = PITCH_START + (PITCH_END - PITCH_START) * climb;
		this.camera.lookAt(
			this.camera.position.x - 0.5,
			this.camera.position.y + Math.tan(pitch) * LOOK_DISTANCE,
			this.camera.position.z - LOOK_DISTANCE,
		);

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

function fitted(object: THREE.Object3D, height: number): THREE.Group {
	const bounds = new THREE.Box3().setFromObject(object);
	const size = bounds.getSize(new THREE.Vector3());
	if (size.y > 0) {
		object.scale.multiplyScalar(height / size.y);
	}
	const scaled = new THREE.Box3().setFromObject(object);
	object.position.y -= scaled.min.y;
	const wrapper = new THREE.Group();
	wrapper.add(object);
	return wrapper;
}
