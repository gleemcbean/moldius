import * as THREE from "three";
import type { PostEffectLevels } from "../../../types/settings";

export interface PostEffectsFrame {
	dt: number;
	effects: PostEffectLevels;
	tension: number;
	animated: boolean;
	colorLevels: number;
	desaturate?: number;
	nausea?: number;
}

export const POST_BULGE = 0.3;
export const HUD_BEND = 0.38;
const HUD_SHIFT = 0.1;

const VERTEX = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = `
uniform sampler2D scene;
uniform sampler2D hud;
uniform vec2 hudSize;
uniform float hudOn;
uniform float desaturate;
uniform vec2 resolution;
uniform float lines;
uniform float time;
uniform float grainTime;
uniform float tension;
uniform float animated;
uniform float levels;
uniform float nausea;
uniform float curvature;
uniform float aberration;
uniform float bleed;
uniform float vignetteAmount;
uniform float grainAmount;
uniform float scanlines;
uniform float dither;
uniform float flicker;
uniform float band;
uniform float saturation;
varying vec2 vUv;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

float hash(vec2 point) {
  vec3 p3 = fract(vec3(point.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float bayer2(vec2 cell) {
  cell = floor(cell);
  return fract(cell.x * 0.5 + cell.y * cell.y * 0.75);
}

float bayer4(vec2 cell) {
  return bayer2(cell * 0.5) * 0.25 + bayer2(cell);
}

vec2 hudTexel(vec2 point) {
  vec2 texel = point * hudSize;
  vec2 seam = floor(texel + 0.5);
  vec2 spread = max(fwidth(texel), vec2(0.0001));
  return (seam + clamp((texel - seam) / spread, -0.5, 0.5)) / hudSize;
}

void main() {
  vec2 centered = vUv - 0.5;
  vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
  vec2 radial = centered * aspect;
  float spread = dot(radial, radial);
  float bulge = ${POST_BULGE.toFixed(3)} * curvature;
  vec2 uv = 0.5 + centered * (1.0 + bulge * spread) / (1.0 + bulge * (0.25 + 0.25 * aspect.x * aspect.x));
  vec2 shift = centered * spread * (0.012 * aberration + 0.014 * tension);
  vec2 doubled = vec2(0.0);
  if (nausea > 0.001) {
    uv += vec2(sin(uv.y * 9.0 + time * 1.7), cos(uv.x * 7.0 + time * 1.3)) * 0.014 * nausea;
    float turn = sin(time * 0.55) * 0.05 * nausea;
    vec2 around = (uv - 0.5) * aspect;
    around = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * around;
    uv = 0.5 + around / aspect;
    shift += vec2(sin(time * 2.1), cos(time * 1.7)) * 0.007 * nausea;
    doubled = vec2(sin(time * 0.9), cos(time * 0.7)) * 0.016 * nausea;
  }
  vec3 color = vec3(
    texture2D(scene, uv + shift).r,
    texture2D(scene, uv).g,
    texture2D(scene, uv - shift).b
  );
  if (bleed > 0.001) {
    vec2 smear = vec2(1.6 / resolution.x, 0.0);
    vec3 smeared = (color + texture2D(scene, uv - smear).rgb + texture2D(scene, uv - smear * 2.0).rgb) / 3.0;
    color = mix(color, smeared - dot(smeared, LUMA) + dot(color, LUMA), 0.7 * bleed);
  }
  if (nausea > 0.001) {
    color = mix(color, texture2D(scene, uv + doubled).rgb, 0.38 * nausea);
    color *= mix(vec3(1.0), vec3(0.86, 1.08, 0.78), nausea * 0.6);
  }

  vec2 corner = abs(centered) * 2.0;
  float edge = pow(corner.x, 6.0) + pow(corner.y, 6.0);
  float vignette = smoothstep(1.05, 0.2, length(radial) * (1.0 + tension * 0.22));
  vignette *= 1.0 - smoothstep(0.55, 1.6, edge) * 0.55;

  float gray = dot(color, LUMA);
  color = max(mix(vec3(gray), color, 1.0 + 0.12 * saturation), 0.0);

  color *= 1.0 - animated * flicker * (0.012 * sin(time * 47.0) + 0.008 * sin(time * 13.0));

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dot(gl_FragColor.rgb, LUMA)), desaturate);

  float hudAlpha = 0.0;
  if (hudOn > 0.5) {
    vec2 hudUv = mix(vUv, uv, ${HUD_BEND.toFixed(3)});
    vec4 hudMain = texture2D(hud, hudTexel(hudUv));
    vec2 hudShift = shift * ${HUD_SHIFT.toFixed(3)};
    float hudRed = texture2D(hud, hudTexel(hudUv + hudShift)).r;
    float hudBlue = texture2D(hud, hudTexel(hudUv - hudShift)).b;
    hudAlpha = hudMain.a;
    gl_FragColor.rgb = vec3(hudRed, hudMain.g, hudBlue) + gl_FragColor.rgb * (1.0 - hudAlpha);
  }

  float luminance = dot(gl_FragColor.rgb, LUMA);
  float noise = hash(floor(gl_FragCoord.xy) + grainTime * 131.0) - 0.5;
  gl_FragColor.rgb += noise * (0.022 + 0.03 * (1.0 - luminance)) * grainAmount;

  float scan = 0.5 + 0.5 * sin(vUv.y * lines * 6.28318);
  gl_FragColor.rgb *= 1.0 - scan * 0.07 * scanlines;

  float roll = fract(vUv.y * 0.6 - time * 0.07);
  gl_FragColor.rgb *= 1.0 + animated * band * smoothstep(0.0, 0.04, roll) * smoothstep(0.1, 0.04, roll) * 0.035;

  float pattern = bayer4(gl_FragCoord.xy);
  float shadow = 1.0 - smoothstep(0.02, 0.4, luminance);
  gl_FragColor.rgb += (pattern - 0.5) * 0.05 * shadow * dither;
  gl_FragColor.rgb = floor(clamp(gl_FragColor.rgb, 0.0, 1.0) * levels + pattern) / levels;
  gl_FragColor.rgb *= 1.0 - (1.0 - vignette) * (0.62 * vignetteAmount + 0.25 * tension) * (1.0 - hudAlpha * 0.9);
  gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 1.0);
}
`;

export class PostEffects {
	private readonly target: THREE.WebGLRenderTarget;
	private readonly material: THREE.ShaderMaterial;
	private readonly quad: THREE.Mesh;
	private readonly scene = new THREE.Scene();
	private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	private readonly size = new THREE.Vector2();
	private time = 0;
	private tension = 0;
	private nausea = 0;

	constructor(
		private readonly renderer: THREE.WebGLRenderer,
		samples: number,
	) {
		this.target = new THREE.WebGLRenderTarget(1, 1, {
			type: THREE.HalfFloatType,
			depthBuffer: true,
			samples,
		});
		this.material = new THREE.ShaderMaterial({
			vertexShader: VERTEX,
			fragmentShader: FRAGMENT,
			uniforms: {
				scene: { value: this.target.texture },
				hud: { value: null },
				hudSize: { value: new THREE.Vector2(1, 1) },
				hudOn: { value: 0 },
				desaturate: { value: 0 },
				resolution: { value: new THREE.Vector2(1, 1) },
				lines: { value: 300 },
				time: { value: 0 },
				grainTime: { value: 0 },
				tension: { value: 0 },
				animated: { value: 1 },
				levels: { value: 127 },
				nausea: { value: 0 },
				curvature: { value: 0 },
				aberration: { value: 0 },
				bleed: { value: 0 },
				vignetteAmount: { value: 0 },
				grainAmount: { value: 0 },
				scanlines: { value: 0 },
				dither: { value: 0 },
				flicker: { value: 0 },
				band: { value: 0 },
				saturation: { value: 0 },
			},
			depthTest: false,
			depthWrite: false,
		});
		this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
		this.quad.frustumCulled = false;
		this.scene.add(this.quad);
	}

	setHud(texture: THREE.Texture, width: number, height: number): void {
		const uniforms = this.material.uniforms;
		uniforms.hud.value = texture;
		uniforms.hudSize.value.set(width, height);
		uniforms.hudOn.value = 1;
	}

	clearHud(): void {
		this.material.uniforms.hudOn.value = 0;
	}

	render(frame: PostEffectsFrame, draw: () => void): void {
		this.time += frame.dt;
		this.tension +=
			(Math.min(1, Math.max(0, frame.tension)) - this.tension) *
			Math.min(1, frame.dt * 3);
		this.renderer.getDrawingBufferSize(this.size);
		if (
			this.target.width !== this.size.x ||
			this.target.height !== this.size.y
		) {
			this.target.setSize(this.size.x, this.size.y);
		}
		const uniforms = this.material.uniforms;
		const cssHeight = this.size.y / this.renderer.getPixelRatio();
		uniforms.resolution.value.set(this.size.x, this.size.y);
		uniforms.lines.value = Math.min(cssHeight / 3, this.size.y / 2.5);
		uniforms.time.value = this.time;
		uniforms.grainTime.value = Math.floor(this.time * 24) / 24;
		const effects = frame.effects;
		uniforms.tension.value = this.tension * effects.danger;
		uniforms.animated.value = frame.animated ? 1 : 0;
		uniforms.levels.value = frame.colorLevels;
		this.nausea +=
			(Math.min(1, Math.max(0, frame.nausea ?? 0)) - this.nausea) *
			Math.min(1, frame.dt * 1.5);
		uniforms.nausea.value = this.nausea;
		uniforms.desaturate.value = (frame.desaturate ?? 0) * 0.75 * effects.danger;
		uniforms.curvature.value = effects.curvature;
		uniforms.aberration.value = effects.aberration;
		uniforms.bleed.value = effects.bleed;
		uniforms.vignetteAmount.value = effects.vignette;
		uniforms.grainAmount.value = effects.grain;
		uniforms.scanlines.value = effects.scanlines;
		uniforms.dither.value = effects.dither;
		uniforms.flicker.value = effects.flicker;
		uniforms.band.value = effects.band;
		uniforms.saturation.value = effects.saturation;

		const previous = this.renderer.getRenderTarget();
		this.renderer.setRenderTarget(this.target);
		draw();
		this.renderer.setRenderTarget(previous);
		this.renderer.render(this.scene, this.camera);
	}

	renderSquare(source: THREE.Texture, side: number): void {
		const uniforms = this.material.uniforms;
		const saved = {
			scene: uniforms.scene.value,
			hudOn: uniforms.hudOn.value,
			desaturate: uniforms.desaturate.value,
			tension: uniforms.tension.value,
			lines: uniforms.lines.value,
			resolution: uniforms.resolution.value.clone(),
		};
		uniforms.scene.value = source;
		uniforms.hudOn.value = 0;
		uniforms.desaturate.value = 0;
		uniforms.tension.value = 0;
		uniforms.resolution.value.set(side, side);
		uniforms.lines.value = side / 3;
		this.renderer.render(this.scene, this.camera);
		uniforms.scene.value = saved.scene;
		uniforms.hudOn.value = saved.hudOn;
		uniforms.desaturate.value = saved.desaturate;
		uniforms.tension.value = saved.tension;
		uniforms.lines.value = saved.lines;
		uniforms.resolution.value.copy(saved.resolution);
	}

	dispose(): void {
		this.target.dispose();
		this.material.dispose();
		this.quad.geometry.dispose();
	}
}
