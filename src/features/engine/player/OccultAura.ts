import type { OccultId } from "@shared/config/occult";
import * as THREE from "three";

interface AuraStyle {
	color: number;
	anchor: number;
	rise: number;
	swirl: number;
	spread: number;
}

const STYLES: Record<OccultId, AuraStyle> = {
	pendulum: {
		color: 0xb070ff,
		anchor: 0.16,
		rise: 0.09,
		swirl: 2.4,
		spread: 0.05,
	},
	blackMirror: {
		color: 0x7ab0ff,
		anchor: 0.66,
		rise: 0.05,
		swirl: 1.6,
		spread: 0.08,
	},
	runeSkull: {
		color: 0xff5a24,
		anchor: 0.55,
		rise: 0.12,
		swirl: 0.8,
		spread: 0.085,
	},
	athame: {
		color: 0xff2a4d,
		anchor: 0.62,
		rise: 0.1,
		swirl: 0.5,
		spread: 0.035,
	},
	jadeEye: { color: 0x3dffa8, anchor: 0.5, rise: 0.05, swirl: 2, spread: 0.07 },
	censer: {
		color: 0xff8a30,
		anchor: 0.3,
		rise: 0.2,
		swirl: 1.1,
		spread: 0.035,
	},
};

/** La couleur propre à chaque objet occulte (aura, pentacle de capture). */
export function occultColor(id: OccultId): number {
	return STYLES[id].color;
}

const PARTICLES = 26;
const PARTICLE_SIZE = 0.015;
const HALO_SIZE = 0.36;
const HALO_OPACITY = 0.17;

interface Particle {
	age: number;
	speed: number;
	angle: number;
	radius: number;
	twinkle: number;
}

function softDot(): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
	gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
	gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.45)");
	gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
	context.fillStyle = gradient;
	context.fillRect(0, 0, 64, 64);
	return new THREE.CanvasTexture(canvas);
}

export class OccultAura {
	readonly root = new THREE.Group();
	private readonly texture = softDot();
	private readonly haloMaterial: THREE.SpriteMaterial;
	private readonly halo: THREE.Sprite;
	private readonly particleMaterial: THREE.PointsMaterial;
	private readonly geometry = new THREE.BufferGeometry();
	private readonly positions = new Float32Array(PARTICLES * 3);
	private readonly colors = new Float32Array(PARTICLES * 3);
	private readonly particles: Particle[] = [];
	private readonly tint = new THREE.Color();
	private style: AuraStyle = STYLES.pendulum;
	private time = 0;

	constructor() {
		this.haloMaterial = new THREE.SpriteMaterial({
			map: this.texture,
			blending: THREE.AdditiveBlending,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			fog: false,
			opacity: 0,
		});
		this.halo = new THREE.Sprite(this.haloMaterial);
		this.halo.scale.setScalar(HALO_SIZE);
		this.root.add(this.halo);
		this.particleMaterial = new THREE.PointsMaterial({
			map: this.texture,
			size: PARTICLE_SIZE,
			sizeAttenuation: true,
			vertexColors: true,
			blending: THREE.AdditiveBlending,
			transparent: true,
			depthWrite: false,
			fog: false,
		});
		this.geometry.setAttribute(
			"position",
			new THREE.BufferAttribute(this.positions, 3),
		);
		this.geometry.setAttribute(
			"color",
			new THREE.BufferAttribute(this.colors, 3),
		);
		const points = new THREE.Points(this.geometry, this.particleMaterial);
		points.frustumCulled = false;
		this.root.add(points);
		for (let index = 0; index < PARTICLES; index += 1) {
			const particle: Particle = {
				age: 0,
				speed: 0,
				angle: 0,
				radius: 0,
				twinkle: 0,
			};
			this.respawn(particle);
			particle.age = Math.random();
			this.particles.push(particle);
		}
		this.root.visible = false;
	}

	get color(): number {
		return this.style.color;
	}

	show(id: OccultId, objectHeight: number): void {
		this.style = STYLES[id];
		this.tint.setHex(this.style.color);
		this.haloMaterial.color.copy(this.tint);
		this.root.position.y = objectHeight * this.style.anchor;
	}

	/**
	 * resonance : de 0 à 1, l'objet est à portée d'un monstre qu'il peut capturer. L'aura
	 * grossit, tourne plus vite et pulse.
	 */
	update(dt: number, strength: number, animated: boolean, resonance = 0): void {
		this.root.visible = strength > 0.01;
		if (!this.root.visible) {
			this.haloMaterial.opacity = 0;
			return;
		}
		const step = animated ? dt : 0;
		this.time += step;
		const beat = resonance * (0.5 + 0.5 * Math.sin(this.time * 9)) ** 3;
		const pulse = 1 + Math.sin(this.time * 2.6) * 0.2 + beat * 1.4;
		this.haloMaterial.opacity =
			HALO_OPACITY * strength * pulse * (1 + resonance * 1.3);
		this.halo.scale.setScalar(HALO_SIZE * (1 + resonance * 0.7 + beat * 0.25));
		const rise = this.style.rise * (1 + resonance * 1.5);
		const swirl = this.style.swirl * (1 + resonance * 2.5);
		const spread = this.style.spread * (1 + resonance * 1.2);
		const boost = 1 + resonance * 1.6;
		this.particles.forEach((particle, index) => {
			particle.age += step * particle.speed * (1 + resonance * 1.4);
			if (particle.age >= 1) {
				this.respawn(particle);
			}
			const age = particle.age;
			const angle = particle.angle + age * swirl;
			const distance = particle.radius * spread * (0.7 + age * 0.6);
			const offset = index * 3;
			this.positions[offset] = Math.cos(angle) * distance;
			this.positions[offset + 1] = (age - 0.35) * rise;
			this.positions[offset + 2] = Math.sin(angle) * distance;
			const flicker = 0.75 + Math.sin(this.time * particle.twinkle) * 0.25;
			const light = Math.sin(age * Math.PI) * flicker * strength * boost;
			this.colors[offset] = this.tint.r * light;
			this.colors[offset + 1] = this.tint.g * light;
			this.colors[offset + 2] = this.tint.b * light;
		});
		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.attributes.color.needsUpdate = true;
	}

	private respawn(particle: Particle): void {
		particle.age = 0;
		particle.speed = 0.35 + Math.random() * 0.45;
		particle.angle = Math.random() * Math.PI * 2;
		particle.radius = 0.35 + Math.random() * 0.75;
		particle.twinkle = 5 + Math.random() * 7;
	}

	dispose(): void {
		this.geometry.dispose();
		this.haloMaterial.dispose();
		this.particleMaterial.dispose();
		this.texture.dispose();
	}
}
