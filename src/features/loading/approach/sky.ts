import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import { MOON_DIRECTION, SECOND_MOON_DIRECTION } from "./layout";

const SKY_VERTEX = `
varying vec3 vDirection;

void main() {
	vDirection = position;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = `
uniform vec3 moonDirection;
uniform vec3 secondMoonDirection;
uniform float time;
varying vec3 vDirection;

float starHash(vec3 point) {
	point = fract(point * 0.3183099 + 0.1);
	point *= 17.0;

	return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
}

float softNoise(vec2 point) {
	vec2 cell = floor(point);
	vec2 local = fract(point);
	vec2 blend = local * local * (3.0 - 2.0 * local);
	float a = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
	float b = fract(sin(dot(cell + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
	float c = fract(sin(dot(cell + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
	float d = fract(sin(dot(cell + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);

	return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

vec3 aurora(vec3 direction, float height) {
	float azimuth = atan(direction.x, direction.z);
	float wave = sin(azimuth * 3.0 + time * 0.07 + sin(azimuth * 7.0 - time * 0.11) * 0.7);
	float curtain = smoothstep(0.12, 0.42, height) * (1.0 - smoothstep(0.48, 0.82, height));
	float ripple = softNoise(vec2(azimuth * 9.0 + time * 0.08, height * 14.0 - time * 0.35));
	float strength = pow(max(wave * 0.5 + 0.5, 0.0), 3.0) * curtain * (0.45 + ripple * 0.55);
	vec3 low = vec3(0.22, 0.95, 0.72);
	vec3 high = vec3(0.62, 0.36, 1.0);

	return mix(low, high, smoothstep(0.2, 0.62, height)) * strength;
}

void main() {
	vec3 direction = normalize(vDirection);
	float height = clamp(direction.y, -0.2, 1.0);
	vec3 horizon = vec3(0.17, 0.09, 0.27);
	vec3 zenith = vec3(0.012, 0.008, 0.045);
	vec3 color = mix(horizon, zenith, pow(max(height, 0.0), 0.45));

	color += aurora(direction, height) * 0.34;

	float moon = max(dot(direction, moonDirection), 0.0);
	float moonAngle = acos(clamp(moon, -1.0, 1.0));
	float halo = exp(-pow((moonAngle - 0.085) / 0.012, 2.0));

	color += vec3(0.82, 0.86, 1.0) * pow(moon, 90.0) * 0.45;
	color += vec3(0.62, 0.48, 0.98) * pow(moon, 8.0) * 0.18;
	color += vec3(0.75, 0.62, 1.0) * halo * 0.22;

	float secondMoon = max(dot(direction, secondMoonDirection), 0.0);

	color += vec3(0.45, 1.0, 0.82) * pow(secondMoon, 40.0) * 0.18;

	float seed = starHash(floor(direction * 320.0));
	float twinkle = 0.6 + 0.4 * sin(time * 1.7 + seed * 80.0);
	float star = step(0.9955, seed) * smoothstep(0.02, 0.3, height) * twinkle;
	vec3 starColor = mix(vec3(0.85, 0.9, 1.0), vec3(0.9, 0.75, 1.0), fract(seed * 37.0));

	color += starColor * star * (1.0 - smoothstep(0.9, 0.99, moon));

	gl_FragColor = vec4(color, 1.0);

	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;

export function skyMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		side: THREE.BackSide,
		depthWrite: false,
		fog: false,
		uniforms: {
			moonDirection: { value: MOON_DIRECTION.clone() },
			secondMoonDirection: { value: SECOND_MOON_DIRECTION.clone() },
			time: { value: 0 },
		},
		vertexShader: SKY_VERTEX,
		fragmentShader: SKY_FRAGMENT,
	});
}

function canvasTexture(
	size: number,
	paint: (context: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");

	canvas.width = size;
	canvas.height = size;

	paint(canvas.getContext("2d") as CanvasRenderingContext2D);

	return new THREE.CanvasTexture(canvas);
}

export function moonTexture(): THREE.CanvasTexture {
	const texture = canvasTexture(128, (context) => {
		const gradient = context.createRadialGradient(54, 50, 6, 64, 64, 62);

		gradient.addColorStop(0, "#fffdf6");
		gradient.addColorStop(0.85, "#e6e2f0");
		gradient.addColorStop(1, "#c6c0d8");

		context.fillStyle = gradient;

		context.beginPath();
		context.arc(64, 64, 62, 0, Math.PI * 2);
		context.fill();

		const rng = new SeededRandom(7);

		for (let index = 0; index < 14; index += 1) {
			const angle = rng.range(0, Math.PI * 2);
			const distance = rng.range(0, 44);

			context.fillStyle = `rgba(140, 132, 170, ${rng.range(0.12, 0.3).toFixed(2)})`;

			context.beginPath();

			context.arc(
				64 + Math.cos(angle) * distance,
				64 + Math.sin(angle) * distance,
				rng.range(3, 12),
				0,
				Math.PI * 2,
			);

			context.fill();
		}
	});

	texture.colorSpace = THREE.SRGBColorSpace;

	return texture;
}

export function softDotTexture(falloff = 1): THREE.CanvasTexture {
	return canvasTexture(64, (context) => {
		const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);

		gradient.addColorStop(0, "rgba(255,255,255,1)");
		gradient.addColorStop(0.6 * falloff, "rgba(255,255,255,0.6)");
		gradient.addColorStop(1, "rgba(255,255,255,0)");

		context.fillStyle = gradient;

		context.fillRect(0, 0, 64, 64);
	});
}
