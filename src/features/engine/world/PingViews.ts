import * as THREE from "three";
import type { PingClientState } from "../state/ClientWorldState";

const CANVAS_WIDTH = 256;
const CANVAS_HEIGHT = 128;
const SCREEN_SHARE = 0.075;
const LIFT = 0.5;
const MAX_OPACITY = 0.82;
const COLOR_DIMMING = 0.62;

function dimmed(color: string): string {
	const value = Number.parseInt(color.slice(1), 16);
	const channel = (shift: number) =>
		Math.round(((value >> shift) & 0xff) * COLOR_DIMMING);
	return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

export interface PingLook {
	label: string;
	detail: string;
	color: string;
}

interface PingView {
	sprite: THREE.Sprite;
	material: THREE.SpriteMaterial;
	texture: THREE.CanvasTexture;
	context: CanvasRenderingContext2D;
	look: PingLook | null;
	createdAt: number;
	expiresAt: number;
}

export function createPingMaterial(
	texture: THREE.Texture,
): THREE.SpriteMaterial {
	return new THREE.SpriteMaterial({
		map: texture,
		transparent: true,
		depthTest: false,
		depthWrite: false,
		fog: false,
		sizeAttenuation: false,
	});
}

function easeOutBack(t: number): number {
	const c = 1.9;
	const x = t - 1;
	return 1 + (c + 1) * x * x * x + c * x * x;
}

export class PingViews {
	readonly group = new THREE.Group();
	private readonly views = new Map<number, PingView>();
	private time = 0;

	update(
		dt: number,
		pings: readonly PingClientState[],
		serverNow: number,
		fov: number,
		describe: (ping: PingClientState) => PingLook,
	): void {
		this.time += dt;
		const seen = new Set<number>();
		const height = SCREEN_SHARE * 2 * Math.tan((fov * Math.PI) / 360);
		for (const ping of pings) {
			seen.add(ping.id);
			const view = this.views.get(ping.id) ?? this.create(ping);
			const look = describe(ping);
			if (
				!view.look ||
				view.look.label !== look.label ||
				view.look.detail !== look.detail ||
				view.look.color !== look.color
			) {
				this.draw(view, look);
			}
			const age = Math.max(0, (serverNow - view.createdAt) / 1000);
			const remaining = Math.max(0, (view.expiresAt - serverNow) / 1000);
			const pop = age < 0.3 ? easeOutBack(age / 0.3) : 1;
			const scale = height * Math.max(0.05, pop);
			view.sprite.scale.set(scale * 2, scale, 1);
			view.sprite.position.set(
				ping.x,
				ping.y + LIFT + Math.sin(this.time * 2.2 + ping.id) * 0.035,
				ping.z,
			);
			view.material.opacity =
				MAX_OPACITY * Math.min(1, age / 0.12, remaining / 0.9);
		}
		for (const [id, view] of this.views) {
			if (!seen.has(id)) {
				this.remove(id, view);
			}
		}
	}

	clear(): void {
		for (const [id, view] of this.views) {
			this.remove(id, view);
		}
	}

	dispose(): void {
		this.clear();
		this.group.removeFromParent();
	}

	private create(ping: PingClientState): PingView {
		const canvas = document.createElement("canvas");
		canvas.width = CANVAS_WIDTH;
		canvas.height = CANVAS_HEIGHT;
		const context = canvas.getContext("2d") as CanvasRenderingContext2D;
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const material = createPingMaterial(texture);
		const sprite = new THREE.Sprite(material);
		sprite.renderOrder = 999;
		sprite.frustumCulled = false;
		this.group.add(sprite);
		const view: PingView = {
			sprite,
			material,
			texture,
			context,
			look: null,
			createdAt: ping.createdAt,
			expiresAt: ping.expiresAt,
		};
		this.views.set(ping.id, view);
		return view;
	}

	private draw(view: PingView, look: PingLook): void {
		view.look = look;
		const context = view.context;
		const middle = CANVAS_WIDTH / 2;
		context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.lineJoin = "round";
		const color = dimmed(look.color);
		context.beginPath();
		context.moveTo(middle, 46);
		context.lineTo(middle + 15, 64);
		context.lineTo(middle, 82);
		context.lineTo(middle - 15, 64);
		context.closePath();
		context.fillStyle = color;
		context.fill();
		context.strokeStyle = "rgba(0, 0, 0, 0.9)";
		context.lineWidth = 4;
		context.stroke();
		const text = (value: string, y: number, font: string, color: string) => {
			context.font = font;
			context.strokeStyle = "rgba(0, 0, 0, 0.9)";
			context.lineWidth = 6;
			context.strokeText(value, middle, y);
			context.fillStyle = color;
			context.fillText(value, middle, y);
		};
		text(look.label, 22, '700 30px "Barlow Condensed", sans-serif', color);
		text(
			look.detail,
			108,
			'600 24px "Barlow Condensed", sans-serif',
			"#bfc2b4",
		);
		view.texture.needsUpdate = true;
	}

	private remove(id: number, view: PingView): void {
		view.sprite.removeFromParent();
		view.texture.dispose();
		view.material.dispose();
		this.views.delete(id);
	}
}
