import { pointInPolygon } from "@shared/manor/polygon";
import type { ManorLayout, Room } from "@shared/manor/types";
import * as THREE from "three";
import { type AtmosphereStyle, atmosphereOf } from "./atmospheres";

const MIN_SPORES = 24;
const MAX_SPORES = 520;
const SPORE_CEILING = 3.4;
const VISIBLE_RANGE = 34;
const MIST_LAYERS = [0.22, 0.62] as const;
const MAX_CORNERS = 24;
const EDGE_FADE = 1.4;

const SPORE_VERTEX = `
attribute vec3 aRange;
attribute vec3 aTint;
attribute float aPhase;
uniform float uTime;
uniform float uScale;
uniform float uRise;
uniform float uSwirl;
uniform float uSize;
varying vec3 vTint;
varying float vAlpha;
void main() {
	float height = aRange.y;
	float lift = mod(position.y - aRange.x + uTime * uRise * (0.6 + aPhase), height);
	vec3 drifted = vec3(
		position.x + sin(uTime * (0.35 + aPhase * 0.4) + aPhase * 6.2831) * uSwirl,
		aRange.x + lift,
		position.z + cos(uTime * (0.3 + aPhase * 0.5) + aPhase * 4.1) * uSwirl
	);
	vec4 view = modelViewMatrix * vec4(drifted, 1.0);
	float depth = -view.z;
	float edge = smoothstep(0.0, 0.35, lift) * (1.0 - smoothstep(height - 0.5, height, lift));
	float near = smoothstep(0.3, 1.1, depth);
	float far = 1.0 - smoothstep(10.0, 18.0, depth);
	float twinkle = 0.55 + 0.45 * sin(uTime * (1.3 + aPhase * 2.0) + aPhase * 6.2831);
	vTint = aTint;
	vAlpha = edge * near * far * twinkle;
	gl_PointSize = clamp(uSize * uScale * (0.7 + aPhase * 0.6) / max(depth, 0.1), 1.0, 26.0);
	gl_Position = projectionMatrix * view;
}`;

const SPORE_FRAGMENT = `
varying vec3 vTint;
varying float vAlpha;
void main() {
	float distance = length(gl_PointCoord - 0.5) * 2.0;
	float core = 1.0 - smoothstep(0.0, 0.35, distance);
	float halo = 1.0 - smoothstep(0.2, 1.0, distance);
	float glow = core * 0.9 + halo * 0.45;
	gl_FragColor = vec4(vTint, glow * vAlpha);
}`;

const MIST_VERTEX = `
varying vec2 vWorld;
void main() {
	vec4 world = modelMatrix * vec4(position, 1.0);
	vWorld = world.xz;
	gl_Position = projectionMatrix * viewMatrix * world;
}`;

const MIST_FRAGMENT = `
#define MAX_CORNERS ${MAX_CORNERS}
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec2 uCorners[MAX_CORNERS];
uniform int uCount;
varying vec2 vWorld;
float edgeDistance(vec2 point) {
	float best = 1000.0;
	for (int index = 0; index < MAX_CORNERS; index += 1) {
		if (index >= uCount) {
			break;
		}
		vec2 a = uCorners[index];
		vec2 b = uCorners[int(mod(float(index + 1), float(uCount)))];
		vec2 edge = b - a;
		float along = clamp(dot(point - a, edge) / max(dot(edge, edge), 0.0001), 0.0, 1.0);
		best = min(best, length(point - a - edge * along));
	}
	return best;
}
float hash(vec2 point) {
	return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 point) {
	vec2 cell = floor(point);
	vec2 local = fract(point);
	vec2 blend = local * local * (3.0 - 2.0 * local);
	float a = hash(cell);
	float b = hash(cell + vec2(1.0, 0.0));
	float c = hash(cell + vec2(0.0, 1.0));
	float d = hash(cell + vec2(1.0, 1.0));
	return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}
void main() {
	vec2 flow = vWorld * 0.45 + vec2(uTime * 0.05, uTime * 0.03);
	float cloud = noise(flow) * 0.6 + noise(flow * 2.3 - uTime * 0.04) * 0.4;
	float wisps = smoothstep(0.35, 0.85, cloud);
	float inner = smoothstep(0.0, ${EDGE_FADE.toFixed(1)}, edgeDistance(vWorld));
	gl_FragColor = vec4(uColor, wisps * inner * uOpacity);
}`;

interface RoomCloud {
	room: Room;
	center: THREE.Vector3;
	objects: THREE.Object3D[];
}

function randomPointIn(room: Room): THREE.Vector2 | null {
	const { minX, minZ, maxX, maxZ } = room.bounds;

	for (let attempt = 0; attempt < 12; attempt += 1) {
		const point = {
			x: minX + Math.random() * (maxX - minX),
			z: minZ + Math.random() * (maxZ - minZ),
		};

		if (pointInPolygon(point, room.polygon)) {
			return new THREE.Vector2(point.x, point.z);
		}
	}

	return null;
}

function sporeGeometry(
	room: Room,
	style: AtmosphereStyle,
	count: number,
): THREE.BufferGeometry {
	const positions: number[] = [];
	const ranges: number[] = [];
	const tints: number[] = [];
	const phases: number[] = [];
	const color = new THREE.Color();
	const height = Math.min(room.height - 0.2, SPORE_CEILING);

	for (let index = 0; index < count; index += 1) {
		const point = randomPointIn(room);

		if (!point) {
			continue;
		}

		color.setHex(style.spores[index % style.spores.length]);

		positions.push(point.x, room.floorY + Math.random() * height, point.y);
		ranges.push(room.floorY + 0.05, height, 0);
		tints.push(color.r, color.g, color.b);
		phases.push(Math.random());
	}

	const geometry = new THREE.BufferGeometry();

	geometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(positions, 3),
	);

	geometry.setAttribute("aRange", new THREE.Float32BufferAttribute(ranges, 3));
	geometry.setAttribute("aTint", new THREE.Float32BufferAttribute(tints, 3));
	geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));

	geometry.boundingSphere = new THREE.Sphere(
		new THREE.Vector3(
			room.labelPoint.x,
			room.floorY + height / 2,
			room.labelPoint.z,
		),
		Math.hypot(
			room.bounds.maxX - room.bounds.minX,
			room.bounds.maxZ - room.bounds.minZ,
		) /
			2 +
			1,
	);

	return geometry;
}

function mistGeometry(room: Room): THREE.BufferGeometry {
	const shape = new THREE.Shape(
		room.polygon.map((point) => new THREE.Vector2(point.x, -point.z)),
	);

	const geometry = new THREE.ShapeGeometry(shape);

	geometry.rotateX(-Math.PI / 2);

	return geometry;
}

export class RoomAtmospheres {
	readonly group = new THREE.Group();
	private readonly clouds: RoomCloud[] = [];
	private readonly materials: THREE.ShaderMaterial[] = [];
	private readonly geometries: THREE.BufferGeometry[] = [];

	constructor(layout: ManorLayout, quality: number) {
		for (const room of layout.rooms) {
			const atmosphere = atmosphereOf(room.type);

			if (atmosphere) {
				this.build(room, atmosphere.style, atmosphere.density, quality);
			}
		}
	}

	private build(
		room: Room,
		style: AtmosphereStyle,
		density: number,
		quality: number,
	): void {
		const count = Math.round(
			THREE.MathUtils.clamp(
				room.area * style.sporesPerSquareMeter * density * quality,
				MIN_SPORES,
				MAX_SPORES,
			),
		);

		const spores = new THREE.ShaderMaterial({
			vertexShader: SPORE_VERTEX,
			fragmentShader: SPORE_FRAGMENT,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			uniforms: {
				uTime: { value: 0 },
				uScale: { value: 600 },
				uRise: { value: style.rise },
				uSwirl: { value: style.swirl },
				uSize: { value: style.sporeSize },
			},
		});

		const geometry = sporeGeometry(room, style, count);
		const points = new THREE.Points(geometry, spores);
		const objects: THREE.Object3D[] = [points];

		points.renderOrder = 3;

		this.materials.push(spores);
		this.geometries.push(geometry);

		const mist = mistGeometry(room);

		const outline = Math.min(MAX_CORNERS, room.polygon.length);

		const corners = Array.from({ length: MAX_CORNERS }, (_, index) => {
			const corner =
				room.polygon[
					Math.floor(
						(Math.min(index, outline - 1) * room.polygon.length) / outline,
					)
				];

			return new THREE.Vector2(corner.x, corner.z);
		});

		this.geometries.push(mist);

		for (const [index, lift] of MIST_LAYERS.entries()) {
			const material = new THREE.ShaderMaterial({
				vertexShader: MIST_VERTEX,
				fragmentShader: MIST_FRAGMENT,
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				uniforms: {
					uTime: { value: index * 17 },
					uOpacity: {
						value: style.mistOpacity * density * (index === 0 ? 1 : 0.5),
					},
					uColor: { value: new THREE.Color(style.mist) },
					uCorners: { value: corners },
					uCount: { value: outline },
				},
			});

			const layer = new THREE.Mesh(mist, material);

			layer.position.y = room.floorY + lift;
			layer.renderOrder = 2;

			objects.push(layer);
			this.materials.push(material);
		}

		for (const object of objects) {
			this.group.add(object);
		}

		this.clouds.push({
			room,
			center: new THREE.Vector3(
				room.labelPoint.x,
				room.floorY + 1.2,
				room.labelPoint.z,
			),
			objects,
		});
	}

	update(
		dt: number,
		camera: THREE.PerspectiveCamera,
		viewportHeight: number,
	): void {
		const scale = viewportHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));

		for (const material of this.materials) {
			material.uniforms.uTime.value += dt;

			if (material.uniforms.uScale) {
				material.uniforms.uScale.value = scale;
			}
		}

		for (const cloud of this.clouds) {
			const visible =
				cloud.center.distanceTo(camera.position) <
				VISIBLE_RANGE + Math.sqrt(cloud.room.area);

			for (const object of cloud.objects) {
				object.visible = visible;
			}
		}
	}

	dispose(): void {
		for (const geometry of this.geometries) {
			geometry.dispose();
		}

		for (const material of this.materials) {
			material.dispose();
		}

		this.group.clear();
	}
}
