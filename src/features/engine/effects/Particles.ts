import * as THREE from "three";

interface Particle {
	position: THREE.Vector3;
	velocity: THREE.Vector3;
	life: number;
	maxLife: number;
	color: THREE.Color;
	size: number;
	gravity: number;
}

const CAPACITY = 900;

export class ParticleSystem {
	readonly points: THREE.Points;
	private readonly particles: Particle[] = [];
	private readonly positions = new Float32Array(CAPACITY * 3);
	private readonly colors = new Float32Array(CAPACITY * 3);
	private readonly sizes = new Float32Array(CAPACITY);
	scale = 1;

	constructor() {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.BufferAttribute(this.positions, 3),
		);
		geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
		geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));
		const material = new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			vertexColors: true,
			uniforms: { scale: { value: 420 } },
			vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float scale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
			fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          if (max(abs(p.x), abs(p.y)) > 0.5) discard;
          gl_FragColor = vec4(vColor, 1.0);
        }`,
		});
		this.points = new THREE.Points(geometry, material);
		this.points.frustumCulled = false;
	}

	emit(
		origin: THREE.Vector3,
		count: number,
		options: {
			color: number;
			speed: number;
			up?: number;
			life?: number;
			size?: number;
			gravity?: number;
			spread?: number;
		},
	): void {
		const amount = Math.round(count * this.scale);
		for (let index = 0; index < amount; index += 1) {
			if (this.particles.length >= CAPACITY) {
				this.particles.shift();
			}
			const direction = new THREE.Vector3(
				Math.random() - 0.5,
				Math.random() - 0.5 + (options.up ?? 0),
				Math.random() - 0.5,
			).normalize();
			const speed = options.speed * (0.4 + Math.random() * 0.8);
			const life = (options.life ?? 0.8) * (0.6 + Math.random() * 0.6);
			const color = new THREE.Color(options.color).multiplyScalar(
				0.7 + Math.random() * 0.5,
			);
			this.particles.push({
				position: origin
					.clone()
					.add(
						new THREE.Vector3(
							(Math.random() - 0.5) * (options.spread ?? 0.1),
							(Math.random() - 0.5) * (options.spread ?? 0.1),
							(Math.random() - 0.5) * (options.spread ?? 0.1),
						),
					),
				velocity: direction.multiplyScalar(speed),
				life,
				maxLife: life,
				color,
				size: (options.size ?? 0.05) * (0.6 + Math.random() * 0.8),
				gravity: options.gravity ?? 6,
			});
		}
	}

	setPixelRatio(ratio: number): void {
		(this.points.material as THREE.ShaderMaterial).uniforms.scale.value =
			420 * ratio;
	}

	update(dt: number): void {
		for (let index = this.particles.length - 1; index >= 0; index -= 1) {
			const particle = this.particles[index];
			particle.life -= dt;
			if (particle.life <= 0) {
				this.particles.splice(index, 1);
				continue;
			}
			particle.velocity.y -= particle.gravity * dt;
			particle.velocity.multiplyScalar(1 - dt * 0.8);
			particle.position.addScaledVector(particle.velocity, dt);
		}
		const count = this.particles.length;
		for (let index = 0; index < count; index += 1) {
			const particle = this.particles[index];
			const fade = particle.life / particle.maxLife;
			this.positions[index * 3] = particle.position.x;
			this.positions[index * 3 + 1] = particle.position.y;
			this.positions[index * 3 + 2] = particle.position.z;
			this.colors[index * 3] = particle.color.r * fade;
			this.colors[index * 3 + 1] = particle.color.g * fade;
			this.colors[index * 3 + 2] = particle.color.b * fade;
			this.sizes[index] = particle.size;
		}
		const geometry = this.points.geometry;
		geometry.setDrawRange(0, count);
		(geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate =
			true;
		(geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate =
			true;
		(geometry.getAttribute("size") as THREE.BufferAttribute).needsUpdate = true;
	}

	dispose(): void {
		this.points.geometry.dispose();
		(this.points.material as THREE.Material).dispose();
	}
}
