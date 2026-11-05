import type { ManorLayout } from "@shared/manor/types";
import * as THREE from "three";
import type { MaterialLibrary } from "../../world/MaterialLibrary";
import type { DynamicLight } from "../lighting/LightPool";
import type { ClientWorldState } from "../state/ClientWorldState";
import type { ParticleSystem } from "./Particles";

interface ProjectileView {
	mesh: THREE.Mesh;
	light: DynamicLight | null;
}

interface PuddleView {
	mesh: THREE.Mesh;
	material: THREE.MeshStandardMaterial;
}

interface JetView {
	stream: THREE.Mesh;
	pool: THREE.Mesh;
	wheel: THREE.Vector3;
}

export class HazardViews {
	readonly group = new THREE.Group();
	private readonly projectiles = new Map<number, ProjectileView>();
	private readonly puddles = new Map<number, PuddleView>();
	private readonly jets = new Map<number, JetView>();
	private readonly emberGeometry = new THREE.SphereGeometry(0.13, 12, 10);
	private readonly slimeGeometry = new THREE.SphereGeometry(0.2, 12, 10);
	private readonly emberMaterial = new THREE.MeshBasicMaterial({
		color: 0xffa040,
	});
	private readonly slimeMaterial: THREE.Material;
	private readonly puddleGeometry = new THREE.CircleGeometry(1, 28);
	private readonly streamMaterial = new THREE.MeshStandardMaterial({
		color: 0x5aff7a,
		emissive: 0x2a9a3a,
		emissiveIntensity: 0.8,
		transparent: true,
		opacity: 0.55,
		roughness: 0.1,
		depthWrite: false,
	});
	private time = 0;

	constructor(
		private readonly state: ClientWorldState,
		layout: ManorLayout,
		materials: MaterialLibrary,
		private readonly particles: ParticleSystem,
	) {
		this.slimeMaterial = materials.get({
			texture: "slime",
			roughness: 0.15,
			emissive: 0x3a6a1a,
			emissiveIntensity: 0.4,
			fixedRepeat: true,
		});
		for (const valve of layout.valves) {
			const height = valve.spout.y - valve.floorY;
			const stream = new THREE.Mesh(
				new THREE.CylinderGeometry(0.07, 0.16, height, 12, 1, true),
				this.streamMaterial,
			);
			stream.position.set(valve.jet.x, valve.floorY + height / 2, valve.jet.z);
			stream.visible = false;
			const pool = new THREE.Mesh(
				new THREE.CircleGeometry(0.68, 24),
				this.streamMaterial,
			);
			pool.rotation.x = -Math.PI / 2;
			pool.position.set(valve.jet.x, valve.floorY + 0.03, valve.jet.z);
			pool.visible = false;
			this.group.add(stream, pool);
			this.jets.set(valve.id, {
				stream,
				pool,
				wheel: new THREE.Vector3(valve.valve.x, valve.valve.y, valve.valve.z),
			});
		}
	}

	update(dt: number, serverTime: number, dynamicLights: DynamicLight[]): void {
		this.time += dt;
		this.syncProjectiles(serverTime, dynamicLights);
		this.syncPuddles(serverTime);
		this.syncJets(serverTime);
	}

	private syncProjectiles(
		serverTime: number,
		dynamicLights: DynamicLight[],
	): void {
		for (const [id, view] of this.projectiles) {
			if (!this.state.projectiles.has(id)) {
				this.group.remove(view.mesh);
				this.projectiles.delete(id);
			}
		}
		for (const projectile of this.state.projectiles.values()) {
			let view = this.projectiles.get(projectile.id);
			if (!view) {
				const ember = projectile.kind === "ember";
				const mesh = new THREE.Mesh(
					ember ? this.emberGeometry : this.slimeGeometry,
					ember ? this.emberMaterial : this.slimeMaterial,
				);
				this.group.add(mesh);
				view = {
					mesh,
					light: ember
						? {
								id: `ember-${projectile.id}`,
								position: new THREE.Vector3(),
								color: 0xff7a2a,
								intensity: 6,
								radius: 5,
								priority: 3,
								flicker: 0.2,
							}
						: null,
				};
				this.projectiles.set(projectile.id, view);
			}
			const t = Math.max(0, serverTime - projectile.launchedAt) / 1000;
			view.mesh.position.set(
				projectile.origin.x + projectile.velocity.x * t,
				projectile.origin.y +
					projectile.velocity.y * t -
					0.5 * projectile.gravity * t * t,
				projectile.origin.z + projectile.velocity.z * t,
			);
			view.mesh.rotation.y += 0.3;
			if (view.light) {
				view.light.position.copy(view.mesh.position);
				dynamicLights.push(view.light);
				if (Math.random() < 0.6) {
					this.particles.emit(view.mesh.position, 1, {
						color: 0xff8a30,
						speed: 0.4,
						life: 0.4,
						size: 0.05,
						gravity: -0.5,
					});
				}
			} else if (Math.random() < 0.3) {
				this.particles.emit(view.mesh.position, 1, {
					color: 0x6aaa2a,
					speed: 0.2,
					life: 0.4,
					size: 0.06,
					gravity: 4,
				});
			}
		}
	}

	private syncPuddles(serverTime: number): void {
		for (const [id, view] of this.puddles) {
			if (!this.state.puddles.has(id)) {
				this.group.remove(view.mesh);
				view.material.dispose();
				this.puddles.delete(id);
			}
		}
		for (const puddle of this.state.puddles.values()) {
			let view = this.puddles.get(puddle.id);
			if (!view) {
				const material = (
					this.slimeMaterial as THREE.MeshStandardMaterial
				).clone();
				material.transparent = true;
				material.depthWrite = false;
				const mesh = new THREE.Mesh(this.puddleGeometry, material);
				mesh.rotation.x = -Math.PI / 2;
				mesh.position.set(puddle.x, puddle.y + 0.025, puddle.z);
				mesh.renderOrder = 1;
				this.group.add(mesh);
				view = { mesh, material };
				this.puddles.set(puddle.id, view);
			}
			const remaining = puddle.expiresAt - serverTime;
			const grow = Math.min(1, (serverTime - puddle.createdAt) / 250);
			view.mesh.scale.setScalar(
				puddle.radius *
					(0.4 + grow * 0.6) *
					(1 + Math.sin(this.time * 2 + puddle.id) * 0.02),
			);
			view.material.opacity = Math.max(0, Math.min(0.92, remaining / 1500));
		}
	}

	private syncJets(serverTime: number): void {
		for (const [valveId, jet] of this.jets) {
			const valve = this.state.valves.get(valveId);
			const active = valve !== undefined && serverTime < valve.activeUntil;
			jet.stream.visible = active;
			jet.pool.visible = active;
			if (active) {
				jet.stream.scale.set(
					1 + Math.sin(this.time * 20) * 0.08,
					1,
					1 + Math.cos(this.time * 17) * 0.08,
				);
				if (Math.random() < 0.7) {
					const base = jet.pool.position.clone();
					this.particles.emit(base, 2, {
						color: 0x6aff8a,
						speed: 1.4,
						up: 1.2,
						life: 0.5,
						size: 0.04,
						gravity: 9,
						spread: 0.3,
					});
				}
			}
		}
	}

	activeJets(serverTime: number): { position: THREE.Vector3 }[] {
		return [...this.jets.entries()]
			.filter(([valveId]) => {
				const valve = this.state.valves.get(valveId);
				return valve !== undefined && serverTime < valve.activeUntil;
			})
			.map(([, jet]) => ({ position: jet.pool.position }));
	}

	dispose(): void {
		this.emberGeometry.dispose();
		this.slimeGeometry.dispose();
		this.emberMaterial.dispose();
		this.puddleGeometry.dispose();
		this.streamMaterial.dispose();
		for (const jet of this.jets.values()) {
			jet.stream.geometry.dispose();
			jet.pool.geometry.dispose();
		}
		for (const view of this.puddles.values()) {
			view.material.dispose();
		}
	}
}
