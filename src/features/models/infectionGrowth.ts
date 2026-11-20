import * as THREE from "three";

const STALK_COLOR = 0xd8823a;
const TIP_COLOR = 0xffa040;
const TIP_GLOW = 0xff7a1a;

const STALKS: readonly [number, number, number, number][] = [
	[0, 0, 0.24, 0],
	[0.6, 0.55, 0.17, 0.35],
	[2.3, 0.6, 0.15, -0.3],
	[3.9, 0.5, 0.19, 0.25],
	[5.1, 0.65, 0.13, -0.4],
];

function stalkGeometry(height: number, lean: number): THREE.BufferGeometry {
	const curve = new THREE.CatmullRomCurve3([
		new THREE.Vector3(0, 0, 0),
		new THREE.Vector3(lean * 0.2, height * 0.5, 0),
		new THREE.Vector3(lean * 0.55, height, lean * 0.15),
	]);

	return new THREE.TubeGeometry(curve, 8, 0.009, 5, false);
}

export class InfectionGrowth {
	readonly group = new THREE.Group();
	private readonly stalkMaterial: THREE.MeshStandardMaterial;
	private readonly tipMaterial: THREE.MeshStandardMaterial;
	private readonly sprouts: THREE.Group[] = [];
	private readonly baseYaws: number[] = [];
	private readonly geometries: THREE.BufferGeometry[] = [];
	private level = 0;

	constructor(top: THREE.Vector3, radius: number) {
		this.stalkMaterial = new THREE.MeshStandardMaterial({
			color: STALK_COLOR,
			roughness: 0.55,
		});

		this.tipMaterial = new THREE.MeshStandardMaterial({
			color: TIP_COLOR,
			emissive: TIP_GLOW,
			emissiveIntensity: 0.8,
			roughness: 0.4,
		});

		const tip = new THREE.SphereGeometry(0.02, 8, 6).scale(1, 1.6, 1);

		this.geometries.push(tip);

		for (const [angle, reach, height, lean] of STALKS) {
			const sprout = new THREE.Group();
			const geometry = stalkGeometry(height, lean);
			const dome = 1 - reach * reach * 0.55;

			this.geometries.push(geometry);

			sprout.position.set(
				top.x + Math.cos(angle) * radius * reach,
				top.y - radius * 0.35 * (1 - dome),
				top.z + Math.sin(angle) * radius * reach,
			);

			sprout.rotation.set(
				Math.sin(angle) * reach * 0.6,
				-angle,
				-Math.cos(angle) * reach * 0.6,
			);

			const knob = new THREE.Mesh(tip, this.tipMaterial);

			knob.position.set(lean * 0.55, height, lean * 0.15);

			sprout.add(new THREE.Mesh(geometry, this.stalkMaterial), knob);

			this.sprouts.push(sprout);
			this.baseYaws.push(sprout.rotation.y);
			this.group.add(sprout);
		}

		this.group.visible = false;
	}

	update(target: number, dt: number, time: number): void {
		this.level += (target - this.level) * Math.min(1, dt * 1.4);

		this.group.visible = this.level > 0.02;

		if (!this.group.visible) {
			return;
		}

		this.sprouts.forEach((sprout, index) => {
			const growth = Math.min(1, Math.max(0, this.level * 1.6 - index * 0.12));
			const twitch = Math.sin(time * (3 + index) + index * 1.7) * 0.08 * target;

			sprout.scale.setScalar(Math.max(0.001, growth));

			sprout.rotation.y = this.baseYaws[index] + twitch;
		});

		this.tipMaterial.emissiveIntensity =
			0.5 + this.level * 0.8 + Math.sin(time * (target > 0.8 ? 9 : 3)) * 0.35;
	}

	dispose(): void {
		for (const geometry of this.geometries) {
			geometry.dispose();
		}

		this.stalkMaterial.dispose();
		this.tipMaterial.dispose();
	}
}
