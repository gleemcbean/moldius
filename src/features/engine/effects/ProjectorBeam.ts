import * as THREE from "three";
import type { DynamicLight } from "../lighting/LightPool";

const WIDE_RADIUS = 0.55;
const NARROW_RADIUS = 0.07;
const BEAM_COLOR = new THREE.Color(0xffe8c0);
const UP = new THREE.Vector3(0, 1, 0);

const VERTEX = `
varying float vAlong;
varying vec2 vAround;
void main() {
	vAlong = position.y;
	vAround = vec2(atan(position.z, position.x), position.y);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = `
uniform float uTime;
uniform float uStrength;
uniform float uFlicker;
uniform vec3 uColor;
varying float vAlong;
varying vec2 vAround;
float hash(vec2 point) {
	return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
	float streaks = 0.55 + 0.45 * sin(vAround.x * 23.0 + uTime * 1.7) * sin(vAround.x * 7.0 - uTime * 0.9);
	float grain = hash(floor(vec2(vAround.x * 40.0, vAlong * 60.0 - uTime * 18.0)));
	float dust = step(0.985, grain) * 1.5;
	float fadeIn = smoothstep(0.0, 0.08, vAlong);
	float fadeOut = 1.0 - smoothstep(0.82, 1.0, vAlong);
	float flicker = mix(1.0, 0.72 + 0.28 * step(0.5, fract(uTime * 9.0)), uFlicker);
	float alpha = uStrength * fadeIn * fadeOut * flicker * (0.16 * streaks + dust * 0.25);
	gl_FragColor = vec4(uColor * (1.0 + dust), alpha);
}`;

export class ProjectorBeam {
	readonly mesh: THREE.Mesh;
	readonly light: DynamicLight;
	private readonly material: THREE.ShaderMaterial;
	private readonly direction = new THREE.Vector3();

	constructor(id: number) {
		const geometry = new THREE.CylinderGeometry(
			WIDE_RADIUS,
			NARROW_RADIUS,
			1,
			28,
			1,
			true,
		).translate(0, 0.5, 0);

		this.material = new THREE.ShaderMaterial({
			vertexShader: VERTEX,
			fragmentShader: FRAGMENT,
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide,
			blending: THREE.AdditiveBlending,
			uniforms: {
				uTime: { value: 0 },
				uStrength: { value: 0 },
				uFlicker: { value: 0 },
				uColor: { value: BEAM_COLOR.clone() },
			},
		});

		this.mesh = new THREE.Mesh(geometry, this.material);
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 4;
		this.mesh.visible = false;

		this.light = {
			id: `projector-${id}`,
			position: new THREE.Vector3(),
			color: 0xffe2b8,
			intensity: 0,
			radius: 3.5,
			priority: 3,
			flicker: 0.05,
		};
	}

	update(
		from: THREE.Vector3,
		to: THREE.Vector3,
		strength: number,
		flicker: number,
		time: number,
	): void {
		this.direction.subVectors(to, from);

		const length = this.direction.length();

		this.mesh.visible = strength > 0.01 && length > 0.2;

		if (!this.mesh.visible) {
			this.light.intensity = 0;

			return;
		}

		this.mesh.position.copy(from);
		this.mesh.quaternion.setFromUnitVectors(UP, this.direction.normalize());
		this.mesh.scale.set(1, length, 1);

		this.material.uniforms.uTime.value = time;
		this.material.uniforms.uStrength.value = strength;
		this.material.uniforms.uFlicker.value = flicker;

		this.light.position.lerpVectors(from, to, 0.92);

		this.light.intensity = strength * 1.6;
	}

	hide(): void {
		this.mesh.visible = false;
		this.light.intensity = 0;
	}

	dispose(): void {
		this.mesh.geometry.dispose();
		this.material.dispose();
	}
}
