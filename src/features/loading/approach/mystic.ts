import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import { meterBox, meterTorus } from "../../world/geometryUtils";
import type { MaterialLibrary } from "../../world/MaterialLibrary";
import { crystalGeometry } from "./geometry";
import {
	FACADE_Z,
	SIGIL_CENTER,
	SPIRE_TIP,
	TOWER_TOP,
	TURRET_X,
} from "./layout";
import { CRYSTAL, FLOATING_STONE, RUNE_GLOW } from "./palette";

const MYSTIC_SEED = 4113;
const CRYSTAL_COUNT = 7;
const STONE_COUNT = 9;
const WISP_COUNT = 12;
const RUNE_COUNT = 12;
const WISP_COLORS = [0x7affe0, 0xc89aff, 0xffd08a];
const BEAM_HEIGHT = 70;

interface Orbiter {
	object: THREE.Object3D;
	radius: number;
	height: number;
	speed: number;
	phase: number;
	spin: number;
}

interface Floater {
	object: THREE.Object3D;
	base: THREE.Vector3;
	bob: number;
	phase: number;
	spin: THREE.Vector3;
}

interface Wisp {
	sprite: THREE.Sprite;
	center: THREE.Vector3;
	reach: THREE.Vector2;
	speed: number;
	phase: number;
}

function additiveSprite(
	texture: THREE.Texture,
	color: number,
	opacity: number,
): THREE.Sprite {
	return new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: texture,
			color,
			transparent: true,
			opacity,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			fog: false,
		}),
	);
}

function starLines(radius: number): THREE.BufferGeometry[] {
	const points = Array.from({ length: 5 }, (_, index) => {
		const angle = Math.PI / 2 + (index * Math.PI * 2) / 5;

		return new THREE.Vector2(
			Math.cos(angle) * radius,
			Math.sin(angle) * radius,
		);
	});

	const lines: THREE.BufferGeometry[] = [];

	for (let index = 0; index < 5; index += 1) {
		const from = points[index];
		const to = points[(index + 2) % 5];
		const length = from.distanceTo(to);
		const middle = from.clone().add(to).multiplyScalar(0.5);
		const angle = Math.atan2(to.y - from.y, to.x - from.x);

		lines.push(
			meterBox(length, 0.06, 0.02)
				.rotateZ(angle)
				.translate(middle.x, middle.y, 0),
		);
	}

	return lines;
}

export class MysticDecor {
	readonly root = new THREE.Group();
	private readonly sigil = new THREE.Group();
	private readonly runeRing = new THREE.Group();
	private readonly beam: THREE.Mesh;
	private readonly glows: THREE.Sprite[] = [];
	private readonly crystals: Orbiter[] = [];
	private readonly stones: Floater[] = [];
	private readonly wisps: Wisp[] = [];
	private readonly runeMaterial: THREE.Material;
	private readonly lights: THREE.PointLight[] = [];
	private readonly ownedMaterials: THREE.Material[] = [];

	constructor(
		materials: MaterialLibrary,
		glowTexture: THREE.Texture,
		glowSpots: readonly THREE.Vector3[],
	) {
		const rng = new SeededRandom(MYSTIC_SEED);

		this.runeMaterial = materials.get(RUNE_GLOW);

		this.buildSigil(glowTexture);
		this.buildCrystals(materials, glowTexture, rng);
		this.buildStones(materials, rng);
		this.buildWisps(glowTexture, rng);

		this.beam = this.buildBeam();

		this.buildGlowLights(glowSpots);
	}

	private own<T extends THREE.Material>(material: T): T {
		this.ownedMaterials.push(material);

		return material;
	}

	private buildSigil(glowTexture: THREE.Texture): void {
		const ring = new THREE.Mesh(
			meterTorus(0.95, 0.04, 4, 32),
			this.runeMaterial,
		);

		this.sigil.add(ring);

		for (const line of starLines(0.9)) {
			this.sigil.add(new THREE.Mesh(line, this.runeMaterial));
		}

		for (let index = 0; index < RUNE_COUNT; index += 1) {
			const angle = (index / RUNE_COUNT) * Math.PI * 2;

			const glyph = new THREE.Mesh(
				meterBox(0.07, 0.16, 0.02).rotateZ(index % 3 === 0 ? 0.6 : 0),
				this.runeMaterial,
			);

			glyph.position.set(Math.cos(angle) * 1.12, Math.sin(angle) * 1.12, 0);

			glyph.rotation.z = angle;

			this.runeRing.add(glyph);
		}

		this.sigil.add(this.runeRing);
		this.sigil.position.copy(SIGIL_CENTER);
		this.root.add(this.sigil);

		const halo = additiveSprite(glowTexture, 0xb07aff, 0.55);

		halo.scale.setScalar(4.2);
		halo.position.copy(SIGIL_CENTER).add(new THREE.Vector3(0, 0, 0.3));
		this.glows.push(halo);
		this.root.add(halo);
	}

	private buildCrystals(
		materials: MaterialLibrary,
		glowTexture: THREE.Texture,
		rng: SeededRandom,
	): void {
		const material = materials.get(CRYSTAL);

		for (let index = 0; index < CRYSTAL_COUNT; index += 1) {
			const holder = new THREE.Group();
			const size = rng.range(0.28, 0.5);

			const crystal = new THREE.Mesh(
				crystalGeometry(size, size * 4.5),
				material,
			);

			const glow = additiveSprite(glowTexture, 0xb48aff, 0.45);

			glow.scale.setScalar(size * 6);
			holder.add(crystal, glow);
			this.root.add(holder);

			this.crystals.push({
				object: holder,
				radius: rng.range(4.2, 6.2),
				height: rng.range(1, 6.5),
				speed: rng.range(0.18, 0.32) * (index % 2 === 0 ? 1 : -1),
				phase: (index / CRYSTAL_COUNT) * Math.PI * 2,
				spin: rng.range(0.4, 1.1),
			});
		}
	}

	private buildStones(materials: MaterialLibrary, rng: SeededRandom): void {
		const material = materials.get(FLOATING_STONE);

		const anchors = [
			new THREE.Vector3(-TURRET_X, 15.5, FACADE_Z + 2.2),
			new THREE.Vector3(TURRET_X, 16.5, FACADE_Z + 2),
			new THREE.Vector3(0, 21.5, FACADE_Z + 3.5),
		];

		for (let index = 0; index < STONE_COUNT; index += 1) {
			const anchor = anchors[index % anchors.length];
			const size = rng.range(0.35, 0.9);

			const stone = new THREE.Mesh(
				new THREE.DodecahedronGeometry(size, 0),
				material,
			);

			const base = anchor
				.clone()
				.add(
					new THREE.Vector3(
						rng.range(-2.2, 2.2),
						rng.range(-1.5, 2.5),
						rng.range(-1.2, 1.2),
					),
				);

			stone.position.copy(base);

			stone.castShadow = true;

			this.root.add(stone);

			this.stones.push({
				object: stone,
				base,
				bob: rng.range(0.2, 0.5),
				phase: rng.range(0, Math.PI * 2),
				spin: new THREE.Vector3(
					rng.range(-0.3, 0.3),
					rng.range(-0.4, 0.4),
					rng.range(-0.3, 0.3),
				),
			});
		}
	}

	private buildWisps(glowTexture: THREE.Texture, rng: SeededRandom): void {
		for (let index = 0; index < WISP_COUNT; index += 1) {
			const sprite = additiveSprite(
				glowTexture,
				WISP_COLORS[index % WISP_COLORS.length],
				0.85,
			);

			sprite.scale.setScalar(rng.range(0.35, 0.6));
			this.root.add(sprite);

			this.wisps.push({
				sprite,
				center: new THREE.Vector3(
					rng.range(-12, 12),
					rng.range(0.7, 2.6),
					rng.range(-22, 0),
				),
				reach: new THREE.Vector2(rng.range(1.5, 4.5), rng.range(1, 3)),
				speed: rng.range(0.15, 0.35),
				phase: rng.range(0, Math.PI * 2),
			});
		}
	}

	private buildBeam(): THREE.Mesh {
		const geometry = new THREE.CylinderGeometry(
			0.35,
			1.2,
			BEAM_HEIGHT,
			16,
			1,
			true,
		);

		const beam = new THREE.Mesh(
			geometry,
			this.own(
				new THREE.MeshBasicMaterial({
					color: 0xb07aff,
					transparent: true,
					opacity: 0.12,
					depthWrite: false,
					blending: THREE.AdditiveBlending,
					side: THREE.DoubleSide,
					fog: false,
				}),
			),
		);

		beam.position.set(SPIRE_TIP.x, SPIRE_TIP.y + BEAM_HEIGHT / 2, SPIRE_TIP.z);
		this.root.add(beam);

		return beam;
	}

	private buildGlowLights(glowSpots: readonly THREE.Vector3[]): void {
		for (const spot of glowSpots) {
			const light = new THREE.PointLight(0x5affd0, 2.2, 7, 2);

			light.position.copy(spot);
			this.lights.push(light);
			this.root.add(light);
		}

		const spireLight = new THREE.PointLight(0xb07aff, 6, 16, 2);

		spireLight.position.copy(TOWER_TOP).add(new THREE.Vector3(0, 2, 3));
		this.lights.push(spireLight);
		this.root.add(spireLight);
	}

	update(time: number, animated: boolean): void {
		const pace = animated ? time : 0;
		const pulse = 0.75 + Math.sin(time * 1.6) * 0.25;

		(this.runeMaterial as THREE.MeshBasicMaterial).color.setRGB(
			0.62 + pulse * 0.2,
			0.45 + pulse * 0.15,
			0.95,
		);

		this.runeRing.rotation.z = pace * 0.25;
		this.sigil.rotation.z = -pace * 0.05;

		for (const glow of this.glows) {
			glow.material.opacity = 0.35 + pulse * 0.25;
		}

		for (const crystal of this.crystals) {
			const angle = crystal.phase + pace * crystal.speed;

			crystal.object.position.set(
				TOWER_TOP.x + Math.cos(angle) * crystal.radius,
				TOWER_TOP.y +
					crystal.height -
					4 +
					Math.sin(pace * 0.9 + crystal.phase) * 0.4,
				TOWER_TOP.z + Math.sin(angle) * crystal.radius,
			);

			crystal.object.rotation.y = pace * crystal.spin;
		}

		for (const stone of this.stones) {
			stone.object.position.copy(stone.base);

			stone.object.position.y += Math.sin(pace * 0.7 + stone.phase) * stone.bob;

			stone.object.rotation.set(
				stone.spin.x * pace,
				stone.spin.y * pace,
				stone.spin.z * pace,
			);
		}

		for (const wisp of this.wisps) {
			const t = pace * wisp.speed + wisp.phase;

			wisp.sprite.position.set(
				wisp.center.x + Math.sin(t) * wisp.reach.x,
				wisp.center.y + Math.sin(t * 2.3) * 0.35,
				wisp.center.z + Math.sin(t * 0.7 + 1.3) * wisp.reach.y,
			);

			wisp.sprite.material.opacity =
				0.55 + Math.sin(time * 3 + wisp.phase) * 0.3;
		}

		(this.beam.material as THREE.MeshBasicMaterial).opacity =
			0.09 + Math.sin(time * 0.8) * 0.03 + Math.sin(time * 5.3) * 0.01;

		for (const [index, light] of this.lights.entries()) {
			light.intensity =
				(index === this.lights.length - 1 ? 6 : 2.2) *
				(0.85 + Math.sin(time * 1.3 + index) * 0.15);
		}
	}

	dispose(): void {
		this.root.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}

			if (object instanceof THREE.Sprite) {
				object.material.dispose();
			}
		});

		for (const material of this.ownedMaterials) {
			material.dispose();
		}
	}
}
