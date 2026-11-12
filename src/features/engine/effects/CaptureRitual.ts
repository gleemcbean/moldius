import * as THREE from "three";
import type { AnomalyModel } from "../../models/anomalies/AnomalyModel";
import type { DynamicLight } from "../lighting/LightPool";
import type { ParticleSystem } from "./Particles";

export const RITUAL_FALLBACK_COLOR = 0xb8ff6a;

let pentacleTexture: THREE.CanvasTexture | null = null;

function texture(): THREE.CanvasTexture {
	if (pentacleTexture) {
		return pentacleTexture;
	}
	const size = 256;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	const center = size / 2;
	context.strokeStyle = "#fff";
	context.lineCap = "round";
	context.lineJoin = "round";
	const ring = (radius: number, width: number) => {
		context.lineWidth = width;
		context.beginPath();
		context.arc(center, center, radius, 0, Math.PI * 2);
		context.stroke();
	};
	ring(122, 7);
	ring(100, 4);
	ring(62, 3);
	context.lineWidth = 6;
	context.beginPath();
	for (let index = 0; index <= 5; index += 1) {
		const angle = -Math.PI / 2 + ((index * 2) % 5) * ((Math.PI * 2) / 5);
		const x = center + Math.cos(angle) * 100;
		const y = center + Math.sin(angle) * 100;
		if (index === 0) {
			context.moveTo(x, y);
		} else {
			context.lineTo(x, y);
		}
	}
	context.stroke();
	context.lineWidth = 3;
	for (let index = 0; index < 15; index += 1) {
		const angle = (index / 15) * Math.PI * 2 + 0.2;
		const x = center + Math.cos(angle) * 111;
		const y = center + Math.sin(angle) * 111;
		const tilt = angle + Math.PI / 2;
		const shape = index % 3;
		context.save();
		context.translate(x, y);
		context.rotate(tilt);
		context.beginPath();
		if (shape === 0) {
			context.moveTo(-5, -5);
			context.lineTo(0, 5);
			context.lineTo(5, -5);
		} else if (shape === 1) {
			context.moveTo(-5, 0);
			context.lineTo(5, 0);
			context.moveTo(0, -6);
			context.lineTo(0, 6);
		} else {
			context.moveTo(-4, -6);
			context.lineTo(-4, 6);
			context.lineTo(4, 2);
		}
		context.stroke();
		context.restore();
	}
	pentacleTexture = new THREE.CanvasTexture(canvas);
	pentacleTexture.colorSpace = THREE.SRGBColorSpace;
	return pentacleTexture;
}

export class Pentacle {
	readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

	constructor(radius: number) {
		const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
		geometry.rotateX(-Math.PI / 2);
		const material = new THREE.MeshBasicMaterial({
			map: texture(),
			transparent: true,
			opacity: 0,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2,
		});
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.renderOrder = 2;
		this.mesh.visible = false;
	}

	set(color: number, opacity: number, spin: number): void {
		this.mesh.material.color.setHex(color);
		this.mesh.material.opacity = opacity;
		this.mesh.visible = opacity > 0.005;
		this.mesh.rotation.y = spin;
	}

	dispose(): void {
		this.mesh.geometry.dispose();
		this.mesh.material.dispose();
	}
}

const VINES = 7;
const VINE_RINGS = 34;
const VINE_SIDES = 6;
const GROW_START = 0.12;
const GROW_END = 0.95;
const PULL_START = 1.05;
const PULL_END = 2.25;
const FADE_END = 2.9;

interface Vine {
	mesh: THREE.Mesh;
	indexCount: number;
	caps: { mesh: THREE.Mesh; at: number; size: number }[];
}

function easeInOut(value: number): number {
	return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
}

function progress(time: number, start: number, end: number): number {
	return Math.min(1, Math.max(0, (time - start) / (end - start)));
}

function stalkGeometry(
	curve: THREE.Curve<THREE.Vector3>,
	radius: number,
): THREE.BufferGeometry {
	const frames = curve.computeFrenetFrames(VINE_RINGS, false);
	const positions: number[] = [];
	const normals: number[] = [];
	const indices: number[] = [];
	const point = new THREE.Vector3();
	const normal = new THREE.Vector3();
	for (let ring = 0; ring <= VINE_RINGS; ring += 1) {
		const t = ring / VINE_RINGS;
		curve.getPointAt(t, point);
		const width = radius * (1 - t * 0.72) * (1 + Math.sin(t * 19) * 0.12);
		for (let side = 0; side < VINE_SIDES; side += 1) {
			const angle = (side / VINE_SIDES) * Math.PI * 2;
			normal
				.copy(frames.normals[ring])
				.multiplyScalar(Math.cos(angle))
				.addScaledVector(frames.binormals[ring], Math.sin(angle))
				.normalize();
			positions.push(
				point.x + normal.x * width,
				point.y + normal.y * width,
				point.z + normal.z * width,
			);
			normals.push(normal.x, normal.y, normal.z);
		}
	}
	for (let ring = 0; ring < VINE_RINGS; ring += 1) {
		for (let side = 0; side < VINE_SIDES; side += 1) {
			const a = ring * VINE_SIDES + side;
			const b = ring * VINE_SIDES + ((side + 1) % VINE_SIDES);
			const c = a + VINE_SIDES;
			const d = b + VINE_SIDES;
			indices.push(a, c, b, b, c, d);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(positions, 3),
	);
	geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
	geometry.setIndex(indices);
	return geometry;
}

export interface RitualTarget {
	model: AnomalyModel;
	position: THREE.Vector3;
	floorY: number;
	bodyHeight: number;
	radius: number;
	color: number;
	animate: (dt: number) => void;
}

export class CaptureRitual {
	readonly group = new THREE.Group();
	readonly light: DynamicLight;
	private readonly pentacle: Pentacle;
	private readonly vines: Vine[] = [];
	private readonly vineGroup = new THREE.Group();
	private readonly stalkMaterial: THREE.MeshStandardMaterial;
	private readonly capMaterial: THREE.MeshStandardMaterial;
	private readonly capGeometry = new THREE.SphereGeometry(
		1,
		8,
		5,
		0,
		Math.PI * 2,
		0,
		Math.PI / 2,
	);
	private readonly startY: number;
	private readonly depth: number;
	private time = 0;
	private sporeClock = 0;

	constructor(
		private readonly target: RitualTarget,
		private readonly particles: ParticleSystem,
	) {
		const { position, floorY, color } = target;
		this.startY = target.model.root.position.y;
		const box = new THREE.Box3().setFromObject(target.model.root);
		const measured = box.isEmpty()
			? null
			: {
					height: box.max.y - position.y,
					radius: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
				};
		const bodyHeight = Math.min(
			target.bodyHeight,
			Math.max(0.4, measured?.height ?? target.bodyHeight),
		);
		const radius = Math.min(
			target.radius * 1.2,
			Math.max(0.2, measured?.radius ?? target.radius),
		);
		this.depth = position.y - floorY + bodyHeight + 0.6;
		const ringRadius = Math.max(0.9, radius * 1.9);
		this.pentacle = new Pentacle(ringRadius);
		this.pentacle.mesh.position.set(position.x, floorY + 0.03, position.z);
		this.group.add(this.pentacle.mesh);
		this.light = {
			id: `capture-${Math.random().toString(36).slice(2)}`,
			position: new THREE.Vector3(position.x, floorY + 0.4, position.z),
			color,
			intensity: 0,
			radius: 4.5,
			priority: 3,
			flicker: 0.15,
		};
		this.stalkMaterial = new THREE.MeshStandardMaterial({
			color: 0x35332a,
			roughness: 0.9,
			emissive: color,
			emissiveIntensity: 0.18,
			flatShading: true,
		});
		this.capMaterial = new THREE.MeshStandardMaterial({
			color: 0x2a2620,
			roughness: 0.7,
			emissive: color,
			emissiveIntensity: 0.45,
			flatShading: true,
		});
		this.vineGroup.position.set(position.x, floorY, position.z);
		this.group.add(this.vineGroup);
		const lift = position.y - floorY;
		const wrap = Math.max(0.22, radius * 0.95);
		for (let index = 0; index < VINES; index += 1) {
			const base = (index / VINES) * Math.PI * 2 + Math.random() * 0.4;
			const turn = index % 2 === 0 ? 1 : -1;
			const points = [
				new THREE.Vector3(
					Math.cos(base) * ringRadius * 0.7,
					-0.45,
					Math.sin(base) * ringRadius * 0.7,
				),
				new THREE.Vector3(
					Math.cos(base) * ringRadius * 0.78,
					0.12,
					Math.sin(base) * ringRadius * 0.78,
				),
			];
			const top = 0.5 + Math.random() * 0.4;
			for (let step = 1; step <= 4; step += 1) {
				const angle = base + turn * step * 1.15;
				const reach = wrap * (1.25 - step * 0.08);
				points.push(
					new THREE.Vector3(
						Math.cos(angle) * reach,
						lift + bodyHeight * (0.12 + (top * step) / 4),
						Math.sin(angle) * reach,
					),
				);
			}
			const curve = new THREE.CatmullRomCurve3(points);
			const thickness =
				(0.075 + Math.random() * 0.035) *
				Math.min(1.8, Math.max(1, radius * 1.4));
			const geometry = stalkGeometry(curve, thickness);
			const mesh = new THREE.Mesh(geometry, this.stalkMaterial);
			mesh.geometry.setDrawRange(0, 0);
			mesh.frustumCulled = false;
			this.vineGroup.add(mesh);
			const caps: Vine["caps"] = [];
			for (const at of [0.42, 0.68, 0.97]) {
				const cap = new THREE.Mesh(this.capGeometry, this.capMaterial);
				const where = curve.getPointAt(Math.min(0.99, at));
				const tangent = curve.getTangentAt(Math.min(0.99, at));
				cap.position.copy(where);
				const outward = new THREE.Vector3(where.x, 0, where.z)
					.normalize()
					.multiplyScalar(0.35)
					.add(new THREE.Vector3(0, 1, 0))
					.addScaledVector(tangent, 0.15)
					.normalize();
				cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
				cap.scale.setScalar(0);
				this.vineGroup.add(cap);
				caps.push({
					mesh: cap,
					at,
					size: thickness * (at > 0.9 ? 2.1 : 1.5),
				});
			}
			this.vines.push({
				mesh,
				indexCount: geometry.getIndex()?.count ?? 0,
				caps,
			});
		}
		this.particles.emit(
			new THREE.Vector3(position.x, floorY + 0.1, position.z),
			26,
			{
				color,
				speed: 1.6,
				up: 1.2,
				life: 0.9,
				size: 0.05,
				gravity: -0.6,
				spread: ringRadius,
			},
		);
	}

	get done(): boolean {
		return this.time >= FADE_END;
	}

	update(dt: number): void {
		this.time += dt;
		const time = this.time;
		const { model, color, position, floorY } = this.target;
		const glow =
			progress(time, 0, 0.3) * (1 - progress(time, PULL_END, FADE_END));
		this.pentacle.set(
			color,
			glow * (0.75 + Math.sin(time * 9) * 0.15),
			time * 0.6,
		);
		this.light.intensity = glow * 1.8;
		const grown = easeInOut(progress(time, GROW_START, GROW_END));
		for (const vine of this.vines) {
			const visible = Math.floor((vine.indexCount * grown) / 6) * 6;
			vine.mesh.geometry.setDrawRange(0, visible);
			for (const cap of vine.caps) {
				const open = Math.min(1, Math.max(0, (grown - cap.at) / 0.12));
				cap.mesh.scale.set(
					cap.size * open,
					cap.size * open * 0.75,
					cap.size * open,
				);
			}
		}
		this.capMaterial.emissiveIntensity = 0.4 + Math.sin(time * 7) * 0.15;
		const pull = easeInOut(progress(time, PULL_START, PULL_END));
		const drop = pull * this.depth;
		this.vineGroup.position.y = floorY - drop;
		const struggle = (1 - pull) * Math.min(1, time * 3);
		model.root.position.set(
			position.x + Math.sin(time * 31) * 0.035 * struggle,
			this.startY - drop,
			position.z + Math.cos(time * 27) * 0.035 * struggle,
		);
		model.root.rotation.z = Math.sin(time * 23) * 0.06 * struggle;
		model.root.visible = drop < this.depth - 0.05;
		this.target.animate(dt);
		this.sporeClock += dt;
		if (pull > 0 && pull < 1 && this.sporeClock > 0.07) {
			this.sporeClock = 0;
			this.particles.emit(
				new THREE.Vector3(position.x, floorY + 0.05, position.z),
				3,
				{
					color,
					speed: 0.9,
					up: 1.4,
					life: 0.8,
					size: 0.045,
					gravity: -0.4,
					spread: 0.6,
				},
			);
		}
	}

	dispose(): void {
		this.group.removeFromParent();
		this.target.model.root.removeFromParent();
		this.target.model.dispose();
		this.pentacle.dispose();
		for (const vine of this.vines) {
			vine.mesh.geometry.dispose();
		}
		this.capGeometry.dispose();
		this.stalkMaterial.dispose();
		this.capMaterial.dispose();
	}
}
