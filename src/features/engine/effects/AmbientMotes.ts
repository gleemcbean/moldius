import * as THREE from "three";

const EXTENT = 9;
const PALETTE = [0xffb46a, 0xffd89a, 0xd8f08a, 0xff9a5a, 0xffe6c0];

export class AmbientMotes {
	readonly points: THREE.Points;
	private readonly anchors: Float32Array;
	private readonly drift: Float32Array;
	private readonly positions: Float32Array;
	private readonly material: THREE.ShaderMaterial;
	private time = 0;

	constructor(density = 1) {
		const count = Math.max(12, Math.round(150 * density));
		this.anchors = new Float32Array(count * 3);
		this.drift = new Float32Array(count * 3);
		this.positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);
		const phases = new Float32Array(count);
		const color = new THREE.Color();
		for (let index = 0; index < count; index += 1) {
			for (let axis = 0; axis < 3; axis += 1) {
				this.anchors[index * 3 + axis] = Math.random() * EXTENT;
				this.drift[index * 3 + axis] = (Math.random() - 0.5) * 0.12;
			}
			this.drift[index * 3 + 1] += 0.03;
			color
				.setHex(PALETTE[index % PALETTE.length])
				.multiplyScalar(0.25 + Math.random() * 0.35);
			color.toArray(colors, index * 3);
			phases[index] = Math.random();
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.BufferAttribute(this.positions, 3),
		);
		geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
		geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
		this.material = new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			vertexColors: true,
			uniforms: { time: { value: 0 } },
			vertexShader: `
        attribute float phase;
        uniform float time;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float distance = -mv.z;
          float twinkle = 0.45 + 0.55 * sin(time * (0.9 + phase) + phase * 6.2831);
          float fade = smoothstep(0.35, 1.2, distance) * (1.0 - smoothstep(2.8, 4.4, distance));
          vColor = color * twinkle * twinkle * fade;
          gl_PointSize = distance < 1.6 ? 2.0 : 1.0;
          gl_Position = projectionMatrix * mv;
        }`,
			fragmentShader: `
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, 1.0);
        }`,
		});
		this.points = new THREE.Points(geometry, this.material);
		this.points.frustumCulled = false;
	}

	update(dt: number, center: THREE.Vector3): void {
		this.time += dt;
		this.material.uniforms.time.value = this.time;
		const count = this.positions.length / 3;
		for (let index = 0; index < count; index += 1) {
			for (let axis = 0; axis < 3; axis += 1) {
				const slot = index * 3 + axis;
				const sway =
					Math.sin(this.time * 0.6 + index * 1.7 + axis * 2.1) * 0.05;
				this.anchors[slot] += (this.drift[slot] + sway) * dt;
				const origin = center.getComponent(axis);
				const offset = this.anchors[slot] - origin;
				this.positions[slot] =
					origin + offset - EXTENT * Math.round(offset / EXTENT);
			}
		}
		(
			this.points.geometry.getAttribute("position") as THREE.BufferAttribute
		).needsUpdate = true;
	}

	dispose(): void {
		this.points.geometry.dispose();
		this.material.dispose();
	}
}
