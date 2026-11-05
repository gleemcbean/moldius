import * as THREE from "three";

export interface PostEffectsFrame {
	dt: number;
	strength: number;
	tension: number;
	animated: boolean;
	levels: number;
}

const VERTEX = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = `
uniform sampler2D scene;
uniform vec2 resolution;
uniform float lines;
uniform float time;
uniform float grainTime;
uniform float strength;
uniform float tension;
uniform float animated;
uniform float levels;
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

void main() {
  vec2 centered = vUv - 0.5;
  vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
  vec2 radial = centered * aspect;
  float spread = dot(radial, radial);
  float bulge = 0.3 * strength;
  vec2 uv = 0.5 + centered * (1.0 + bulge * spread) / (1.0 + bulge * (0.25 + 0.25 * aspect.x * aspect.x));
  vec2 shift = centered * spread * (0.012 + tension * 0.014) * strength;
  vec3 color = vec3(
    texture2D(scene, uv + shift).r,
    texture2D(scene, uv).g,
    texture2D(scene, uv - shift).b
  );
  vec2 smear = vec2(1.6 / resolution.x, 0.0);
  vec3 bleed = (color + texture2D(scene, uv - smear).rgb + texture2D(scene, uv - smear * 2.0).rgb) / 3.0;
  color = mix(color, bleed - dot(bleed, LUMA) + dot(color, LUMA), 0.7 * strength);

  vec2 corner = abs(centered) * 2.0;
  float edge = pow(corner.x, 6.0) + pow(corner.y, 6.0);
  float vignette = smoothstep(1.05, 0.2, length(radial) * (1.0 + tension * 0.22));
  vignette *= 1.0 - smoothstep(0.55, 1.6, edge) * 0.55;

  float gray = dot(color, LUMA);
  vec3 graded = max(mix(vec3(gray), color, 1.12), 0.0);
  color = mix(color, graded, strength);

  float flicker = 1.0 - animated * strength * (0.012 * sin(time * 47.0) + 0.008 * sin(time * 13.0));
  color *= flicker;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  float luminance = dot(gl_FragColor.rgb, LUMA);
  float grain = hash(floor(gl_FragCoord.xy) + grainTime * 131.0) - 0.5;
  gl_FragColor.rgb += grain * (0.022 + 0.03 * (1.0 - luminance)) * strength;

  float scan = 0.5 + 0.5 * sin(vUv.y * lines * 6.28318);
  gl_FragColor.rgb *= 1.0 - scan * 0.07 * strength;

  float band = fract(vUv.y * 0.6 - time * 0.07);
  gl_FragColor.rgb *= 1.0 + animated * strength * smoothstep(0.0, 0.04, band) * smoothstep(0.1, 0.04, band) * 0.035;

  float dither = bayer4(gl_FragCoord.xy);
  float shadow = 1.0 - smoothstep(0.02, 0.4, luminance);
  gl_FragColor.rgb += (dither - 0.5) * 0.05 * shadow * strength;
  gl_FragColor.rgb = floor(clamp(gl_FragColor.rgb, 0.0, 1.0) * levels + dither) / levels;
  gl_FragColor.rgb *= 1.0 - (1.0 - vignette) * (0.62 + tension * 0.25) * strength;
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
				resolution: { value: new THREE.Vector2(1, 1) },
				lines: { value: 300 },
				time: { value: 0 },
				grainTime: { value: 0 },
				strength: { value: 1 },
				tension: { value: 0 },
				animated: { value: 1 },
				levels: { value: 127 },
			},
			depthTest: false,
			depthWrite: false,
		});
		this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
		this.quad.frustumCulled = false;
		this.scene.add(this.quad);
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
		uniforms.strength.value = frame.strength;
		uniforms.tension.value = this.tension;
		uniforms.animated.value = frame.animated ? 1 : 0;
		uniforms.levels.value = frame.levels;

		const previous = this.renderer.getRenderTarget();
		this.renderer.setRenderTarget(this.target);
		draw();
		this.renderer.setRenderTarget(previous);
		this.renderer.render(this.scene, this.camera);
	}

	dispose(): void {
		this.target.dispose();
		this.material.dispose();
		this.quad.geometry.dispose();
	}
}
