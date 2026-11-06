import { openingPassage } from "@shared/manor/layoutBuilder";
import { boxCorners } from "@shared/manor/polygon";
import type {
	Level,
	ManorLayout,
	Room,
	RoomType,
	StairSpec,
} from "@shared/manor/types";
import { currentMessages } from "../../i18n";

export interface MapView {
	centerX: number;
	centerZ: number;
	scale: number;
	width: number;
	height: number;
	level: Level;
}

export interface MapMarker {
	x: number;
	z: number;
	yaw: number;
	level: Level;
	color: string;
	name: string;
	dead: boolean;
}

export interface MapDrawOptions {
	labels: boolean;
	labelSize: number;
	grid: boolean;
	compass: boolean;
	scaleBar: boolean;
	player: { x: number; z: number; yaw: number } | null;
	others: MapMarker[];
	names: boolean;
	pinToEdge: boolean;
	currentRoomId: number | null;
	levelBadge: string | null;
	pixelRatio: number;
	silhouette: boolean;
}

const COLORS = {
	background: "#0b0d0b",
	grid: "rgba(239, 227, 184, 0.035)",
	stair: "#1f2536",
	altar: "#2ee6d6",
	corridor: "#171b17",
	wallShadow: "rgba(0, 0, 0, 0.75)",
	wall: "#d8cfa4",
	furniture: "rgba(216, 207, 164, 0.12)",
	furnitureLow: "rgba(216, 207, 164, 0.06)",
	door: "#dce54d",
	glass: "#8fd3e6",
	label: "#efe3b8",
	labelCurrent: "#fff6c8",
	current: "rgba(220, 229, 77, 0.85)",
	silhouetteFill: "rgba(216, 207, 164, 0.05)",
	silhouetteLine: "rgba(239, 227, 184, 0.28)",
	voidFill: "#090a09",
	deckAbove: "rgba(216, 207, 164, 0.07)",
	deckAboveLine: "rgba(216, 207, 164, 0.4)",
	player: "#dce54d",
	cone: "rgba(220, 229, 77, 0.28)",
	stairArrow: "rgba(170, 190, 255, 0.85)",
	badge: "rgba(11, 13, 11, 0.82)",
};

const ROOM_TINTS: Partial<Record<RoomType, string>> = {
	hall: "#2a2519",
	salon: "#2a2519",
	gallery: "#2a2519",
	ballroom: "#2a2519",
	theater: "#2a2519",
	music: "#2a2519",
	billiard: "#2a2519",
	dining: "#2a2519",
	kitchen: "#1c2328",
	cellar: "#1c2328",
	laundry: "#1c2328",
	toilets: "#1c2328",
	bathroom: "#1c2328",
	closet: "#1c2328",
	workshop: "#1c2328",
	attic: "#1c2328",
	undercroft: "#1c2328",
	bedroom: "#271e27",
	nursery: "#271e27",
	study: "#271e27",
	library: "#1b2721",
	alchemy: "#1b2721",
	ritual: "#1b2721",
	observatory: "#1b2721",
	curiosities: "#1b2721",
	chapel: "#1b2721",
	crypt: "#1b2721",
	armory: "#1b2721",
	dungeon: "#1b2721",
	greenhouse: "#1f2c1b",
	pond: "#1a2830",
	corridor: COLORS.corridor,
	stairwell: COLORS.stair,
};

function roomFill(room: Room): string {
	return ROOM_TINTS[room.type] ?? "#20261f";
}

function lighten(hex: string, amount: number): string {
	const value = Number.parseInt(hex.slice(1), 16);
	const channel = (shift: number) => {
		const base = (value >> shift) & 0xff;
		return Math.round(base + (255 - base) * amount);
	};
	return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

const LABEL_FONT = '"Alegreya", Georgia, serif';
const FIGURE_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

interface LabelBox {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

function labelsOverlap(a: LabelBox, b: LabelBox): boolean {
	return (
		a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
	);
}

export function roomLabel(room: Room): string {
	const world = currentMessages().world;
	if (room.type === "stairwell") {
		return world.stairwellLabel;
	}
	return world.rooms[room.type][room.nameIndex] ?? room.name;
}

function labelPriority(room: Room): number {
	const corridorPenalty = room.type === "corridor" ? 1000 : 0;
	return room.area - corridorPenalty;
}

export class MapRenderer {
	constructor(private readonly layout: ManorLayout) {}

	roomsOnLevel(level: Level): Room[] {
		return this.layout.rooms.filter(
			(room) =>
				room.level === level ||
				((room.type === "stairwell" || room.mezzanine !== null) &&
					room.level === level - 1),
		);
	}

	private roomsBelow(level: Level): Room[] {
		return this.layout.rooms.filter(
			(room) =>
				room.level === level - 1 &&
				room.type !== "stairwell" &&
				room.mezzanine === null,
		);
	}

	fitView(width: number, height: number, level: Level): MapView {
		const rooms = this.roomsOnLevel(level);
		let minX = Infinity;
		let minZ = Infinity;
		let maxX = -Infinity;
		let maxZ = -Infinity;
		for (const room of rooms) {
			minX = Math.min(minX, room.bounds.minX);
			minZ = Math.min(minZ, room.bounds.minZ);
			maxX = Math.max(maxX, room.bounds.maxX);
			maxZ = Math.max(maxZ, room.bounds.maxZ);
		}
		const scale = Math.min(
			width / (maxX - minX + 4),
			height / (maxZ - minZ + 4),
		);
		return {
			centerX: (minX + maxX) / 2,
			centerZ: (minZ + maxZ) / 2,
			scale,
			width,
			height,
			level,
		};
	}

	draw(
		context: CanvasRenderingContext2D,
		view: MapView,
		options: MapDrawOptions,
	): void {
		const ratio = options.pixelRatio;
		context.save();
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.fillStyle = COLORS.background;
		context.fillRect(0, 0, view.width, view.height);
		const toX = (x: number) => (x - view.centerX) * view.scale + view.width / 2;
		const toY = (z: number) =>
			(z - view.centerZ) * view.scale + view.height / 2;
		if (options.grid) {
			this.drawGrid(context, view, toX, toY);
		}
		const rooms = this.roomsOnLevel(view.level);
		const wallWidth = Math.max(1.5, view.scale * 0.14);
		const trace = (polygon: { x: number; z: number }[]) => {
			context.beginPath();
			polygon.forEach((point, index) => {
				if (index === 0) {
					context.moveTo(toX(point.x), toY(point.z));
				} else {
					context.lineTo(toX(point.x), toY(point.z));
				}
			});
			context.closePath();
		};
		const outline = (room: Room) => trace(room.polygon);
		const below = options.silhouette ? this.roomsBelow(view.level) : [];
		for (const room of below) {
			outline(room);
			context.fillStyle = COLORS.silhouetteFill;
			context.fill();
			context.strokeStyle = COLORS.silhouetteLine;
			context.lineWidth = 1;
			context.stroke();
		}
		for (const room of rooms) {
			outline(room);
			context.strokeStyle = COLORS.wallShadow;
			context.lineWidth = wallWidth + 3;
			context.stroke();
		}
		for (const room of rooms) {
			outline(room);
			const fill = roomFill(room);
			const shown =
				room.id === options.currentRoomId ? lighten(fill, 0.1) : fill;
			if (room.mezzanine && room.level < view.level) {
				context.fillStyle = COLORS.voidFill;
				context.fill();
				trace(room.mezzanine.deck);
			}
			context.fillStyle = shown;
			context.fill();
		}
		for (const room of rooms) {
			if (room.mezzanine && room.level === view.level) {
				trace(room.mezzanine.deck);
				context.fillStyle = COLORS.deckAbove;
				context.fill();
				context.strokeStyle = COLORS.deckAboveLine;
				context.lineWidth = 1;
				context.setLineDash([3, 3]);
				context.stroke();
				context.setLineDash([]);
			}
		}
		for (const room of rooms) {
			if (room.mezzanine && room.level < view.level) {
				context.strokeStyle = COLORS.wall;
				context.lineWidth = Math.max(1, wallWidth * 0.45);
				for (const rail of room.mezzanine.rails) {
					context.beginPath();
					context.moveTo(toX(rail.a.x), toY(rail.a.z));
					context.lineTo(toX(rail.b.x), toY(rail.b.z));
					context.stroke();
				}
			}
		}
		for (const room of rooms) {
			outline(room);
			context.strokeStyle = COLORS.wall;
			context.lineWidth = wallWidth;
			context.stroke();
		}
		for (const item of this.layout.furniture) {
			const room = this.layout.rooms[item.roomId];
			if (!rooms.includes(room) || item.colliders.length === 0) {
				continue;
			}
			if (room.mezzanine) {
				const onDeck = item.y >= room.mezzanine.floorY - 0.01;
				if (onDeck !== room.level < view.level) {
					continue;
				}
			}
			for (const collider of item.colliders) {
				const corners = boxCorners(collider);
				context.beginPath();
				corners.forEach((corner, index) => {
					if (index === 0) {
						context.moveTo(toX(corner.x), toY(corner.z));
					} else {
						context.lineTo(toX(corner.x), toY(corner.z));
					}
				});
				context.closePath();
				context.fillStyle =
					collider.yMax - collider.yMin < 1.05
						? COLORS.furnitureLow
						: COLORS.furniture;
				context.fill();
			}
		}
		for (const opening of this.layout.openings) {
			if (opening.level !== view.level) {
				continue;
			}
			const passage = openingPassage(opening);
			if (opening.kind === "window") {
				context.beginPath();
				context.moveTo(
					toX((passage[0].x + passage[1].x) / 2),
					toY((passage[0].z + passage[1].z) / 2),
				);
				context.lineTo(
					toX((passage[3].x + passage[2].x) / 2),
					toY((passage[3].z + passage[2].z) / 2),
				);
				context.strokeStyle = COLORS.glass;
				context.lineWidth = Math.max(2, view.scale * 0.12);
				context.stroke();
				continue;
			}
			context.beginPath();
			passage.forEach((point, index) => {
				if (index === 0) {
					context.moveTo(toX(point.x), toY(point.z));
				} else {
					context.lineTo(toX(point.x), toY(point.z));
				}
			});
			context.closePath();
			context.fillStyle = this.openingFill(opening.roomA, opening.roomB);
			context.fill();
			context.lineWidth = Math.max(1, view.scale * 0.06);
			context.strokeStyle = context.fillStyle;
			context.stroke();
			if (opening.door) {
				const middleStart = {
					x: (passage[0].x + passage[1].x) / 2,
					z: (passage[0].z + passage[1].z) / 2,
				};
				const middleEnd = {
					x: (passage[3].x + passage[2].x) / 2,
					z: (passage[3].z + passage[2].z) / 2,
				};
				context.beginPath();
				context.moveTo(toX(middleStart.x), toY(middleStart.z));
				context.lineTo(toX(middleEnd.x), toY(middleEnd.z));
				context.strokeStyle = COLORS.door;
				context.lineWidth = Math.max(2, view.scale * 0.16);
				context.stroke();
			}
		}
		for (const room of rooms) {
			const stair = room.stair ?? room.mezzanine?.stair;
			if (stair) {
				this.drawStairs(context, room, stair, toX, toY, view);
			}
		}
		const current = rooms.find((room) => room.id === options.currentRoomId);
		if (current) {
			outline(current);
			context.strokeStyle = COLORS.current;
			context.lineWidth = Math.max(2, wallWidth * 0.8);
			context.setLineDash([
				Math.max(4, view.scale * 0.4),
				Math.max(3, view.scale * 0.25),
			]);
			context.stroke();
			context.setLineDash([]);
		}
		if (options.labels) {
			this.drawLabels(
				context,
				rooms,
				toX,
				toY,
				options.labelSize,
				view.scale,
				options.currentRoomId,
			);
		}
		this.drawAltars(context, view, toX, toY);
		const markerSize = Math.max(7, Math.min(12, view.scale * 0.6));
		for (const marker of options.others) {
			this.drawMarker(context, marker, toX, toY, view, options, markerSize);
		}
		if (options.player) {
			const size = Math.max(10, Math.min(17, view.scale * 0.8));
			this.drawViewCone(
				context,
				toX(options.player.x),
				toY(options.player.z),
				options.player.yaw,
				Math.max(size * 3.2, view.scale * 3),
			);
			this.drawPlayer(
				context,
				toX(options.player.x),
				toY(options.player.z),
				options.player.yaw,
				size,
			);
		}
		if (options.levelBadge) {
			this.drawBadge(context, options.levelBadge, 8, view.height - 8);
		}
		if (options.compass) {
			this.drawCompass(context, view.width - 46, 46);
		}
		if (options.scaleBar) {
			this.drawScaleBar(context, view);
		}
		context.restore();
	}

	private drawGrid(
		context: CanvasRenderingContext2D,
		view: MapView,
		toX: (x: number) => number,
		toY: (z: number) => number,
	): void {
		const step = view.scale > 20 ? 1 : view.scale > 8 ? 2 : 5;
		const left = view.centerX - view.width / 2 / view.scale;
		const right = view.centerX + view.width / 2 / view.scale;
		const top = view.centerZ - view.height / 2 / view.scale;
		const bottom = view.centerZ + view.height / 2 / view.scale;
		context.strokeStyle = COLORS.grid;
		context.lineWidth = 1;
		context.beginPath();
		for (let x = Math.floor(left / step) * step; x <= right; x += step) {
			context.moveTo(toX(x), 0);
			context.lineTo(toX(x), view.height);
		}
		for (let z = Math.floor(top / step) * step; z <= bottom; z += step) {
			context.moveTo(0, toY(z));
			context.lineTo(view.width, toY(z));
		}
		context.stroke();
	}

	private openingFill(roomA: number, roomB: number): string {
		const rooms = [this.layout.rooms[roomA], this.layout.rooms[roomB]].filter(
			(room): room is Room => room !== undefined,
		);
		const corridor = rooms.find(
			(room) => room.type === "corridor" || room.type === "stairwell",
		);
		return roomFill(corridor ?? rooms[0] ?? this.layout.rooms[0]);
	}

	private drawStairs(
		context: CanvasRenderingContext2D,
		room: Room,
		stair: StairSpec,
		toX: (x: number) => number,
		toY: (z: number) => number,
		view: MapView,
	): void {
		const scale = view.scale;
		const goingUp = room.level === view.level;
		context.strokeStyle = "rgba(170, 190, 255, 0.35)";
		context.lineWidth = Math.max(1, scale * 0.05);
		const steps = 11;
		for (let index = 0; index <= steps; index += 1) {
			const along = stair.bottomLanding + (stair.run * index) / steps;
			const cx = stair.origin.x + stair.forward.x * along;
			const cz = stair.origin.z + stair.forward.z * along;
			context.beginPath();
			context.moveTo(
				toX(cx - (stair.right.x * stair.width) / 2),
				toY(cz - (stair.right.z * stair.width) / 2),
			);
			context.lineTo(
				toX(cx + (stair.right.x * stair.width) / 2),
				toY(cz + (stair.right.z * stair.width) / 2),
			);
			context.stroke();
		}
		const low = {
			x: stair.origin.x + stair.forward.x * 0.5,
			z: stair.origin.z + stair.forward.z * 0.5,
		};
		const high = {
			x: stair.origin.x + stair.forward.x * (stair.length - 0.6),
			z: stair.origin.z + stair.forward.z * (stair.length - 0.6),
		};
		const start = goingUp ? low : high;
		const end = goingUp ? high : low;
		context.beginPath();
		context.moveTo(toX(start.x), toY(start.z));
		context.lineTo(toX(end.x), toY(end.z));
		context.strokeStyle = COLORS.stairArrow;
		context.lineWidth = Math.max(1.5, scale * 0.09);
		context.stroke();
		const angle = Math.atan2(
			toY(end.z) - toY(start.z),
			toX(end.x) - toX(start.x),
		);
		const size = Math.max(6, scale * 0.4);
		context.beginPath();
		context.moveTo(toX(end.x), toY(end.z));
		context.lineTo(
			toX(end.x) - Math.cos(angle - 0.5) * size,
			toY(end.z) - Math.sin(angle - 0.5) * size,
		);
		context.lineTo(
			toX(end.x) - Math.cos(angle + 0.5) * size,
			toY(end.z) - Math.sin(angle + 0.5) * size,
		);
		context.closePath();
		context.fillStyle = COLORS.stairArrow;
		context.fill();
		const middle = {
			x: toX((start.x + end.x) / 2),
			y: toY((start.z + end.z) / 2),
		};
		const radius = Math.max(7, Math.min(13, scale * 0.45));
		context.beginPath();
		context.arc(middle.x, middle.y, radius, 0, Math.PI * 2);
		context.fillStyle = COLORS.badge;
		context.fill();
		context.strokeStyle = COLORS.stairArrow;
		context.lineWidth = 1.5;
		context.stroke();
		context.fillStyle = COLORS.stairArrow;
		context.font = `700 ${Math.round(radius * 1.3)}px ${FIGURE_FONT}`;
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.fillText(goingUp ? "↑" : "↓", middle.x, middle.y + 1);
	}

	private drawLabels(
		context: CanvasRenderingContext2D,
		rooms: Room[],
		toX: (x: number) => number,
		toY: (z: number) => number,
		size: number,
		scale: number,
		currentRoomId: number | null,
	): void {
		context.textAlign = "center";
		context.textBaseline = "middle";
		const placed: LabelBox[] = [];
		const ordered = [...rooms].sort(
			(a, b) =>
				Number(b.id === currentRoomId) - Number(a.id === currentRoomId) ||
				labelPriority(b) - labelPriority(a),
		);
		for (const room of ordered) {
			if (room.type === "corridor" || room.type === "stairwell") {
				continue;
			}
			const label = roomLabel(room);
			const width =
				Math.min(
					room.bounds.maxX - room.bounds.minX,
					room.bounds.maxZ - room.bounds.minZ,
				) * scale;
			const fontSize = Math.round(
				Math.min(size, (width * 1.6) / Math.max(4, label.length * 0.55)),
			);
			if (fontSize < 10) {
				continue;
			}
			context.font = `500 ${fontSize}px ${LABEL_FONT}`;
			const x = toX(room.labelPoint.x);
			const y = toY(room.labelPoint.z);
			const halfWidth = context.measureText(label).width / 2 + 3;
			const box = {
				left: x - halfWidth,
				right: x + halfWidth,
				top: y - fontSize * 0.65,
				bottom: y + fontSize * 0.65,
			};
			if (placed.some((other) => labelsOverlap(other, box))) {
				continue;
			}
			placed.push(box);
			context.lineJoin = "round";
			context.lineWidth = Math.max(3, fontSize * 0.28);
			context.strokeStyle = "rgba(8, 10, 8, 0.9)";
			context.strokeText(label, x, y);
			context.fillStyle =
				room.id === currentRoomId ? COLORS.labelCurrent : COLORS.label;
			context.fillText(label, x, y);
		}
	}

	private drawAltars(
		context: CanvasRenderingContext2D,
		view: MapView,
		toX: (x: number) => number,
		toY: (z: number) => number,
	): void {
		const size = Math.max(6, Math.min(11, view.scale * 0.55));
		for (const altar of this.layout.altars) {
			if (altar.level !== view.level) {
				continue;
			}
			const x = toX(altar.x);
			const y = toY(altar.z);
			context.beginPath();
			for (let index = 0; index < 10; index += 1) {
				const radius = index % 2 === 0 ? size : size * 0.42;
				const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
				const px = x + Math.cos(angle) * radius;
				const py = y + Math.sin(angle) * radius;
				if (index === 0) {
					context.moveTo(px, py);
				} else {
					context.lineTo(px, py);
				}
			}
			context.closePath();
			context.fillStyle = COLORS.altar;
			context.fill();
			context.strokeStyle = COLORS.wallShadow;
			context.lineWidth = 1;
			context.stroke();
		}
	}

	private drawMarker(
		context: CanvasRenderingContext2D,
		marker: MapMarker,
		toX: (x: number) => number,
		toY: (z: number) => number,
		view: MapView,
		options: MapDrawOptions,
		size: number,
	): void {
		let x = toX(marker.x);
		let y = toY(marker.z);
		const margin = size + 3;
		const outside =
			x < margin ||
			y < margin ||
			x > view.width - margin ||
			y > view.height - margin;
		const elsewhere = marker.level !== view.level;
		context.globalAlpha = elsewhere || marker.dead ? 0.6 : 1;
		if (outside && options.pinToEdge) {
			const dx = x - view.width / 2;
			const dy = y - view.height / 2;
			const t = Math.min(
				(view.width / 2 - margin) / Math.max(Math.abs(dx), 1e-6),
				(view.height / 2 - margin) / Math.max(Math.abs(dy), 1e-6),
			);
			x = view.width / 2 + dx * t;
			y = view.height / 2 + dy * t;
			const angle = Math.atan2(dy, dx);
			context.beginPath();
			context.moveTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
			context.lineTo(
				x + Math.cos(angle + 2.3) * size * 0.8,
				y + Math.sin(angle + 2.3) * size * 0.8,
			);
			context.lineTo(
				x + Math.cos(angle - 2.3) * size * 0.8,
				y + Math.sin(angle - 2.3) * size * 0.8,
			);
			context.closePath();
			context.fillStyle = marker.color;
			context.strokeStyle = "#0b0d0b";
			context.lineWidth = 2;
			context.fill();
			context.stroke();
		} else if (outside) {
			context.globalAlpha = 1;
			return;
		} else {
			context.beginPath();
			context.arc(x, y, size * 0.7, 0, Math.PI * 2);
			context.fillStyle = elsewhere ? COLORS.badge : marker.color;
			context.strokeStyle = elsewhere ? marker.color : "#0b0d0b";
			context.lineWidth = elsewhere ? 2.5 : 2;
			context.fill();
			context.stroke();
			if (marker.dead) {
				const arm = size * 0.42;
				context.beginPath();
				context.moveTo(x - arm, y - arm);
				context.lineTo(x + arm, y + arm);
				context.moveTo(x + arm, y - arm);
				context.lineTo(x - arm, y + arm);
				context.strokeStyle = "#0b0d0b";
				context.lineWidth = 2.5;
				context.stroke();
			} else if (!elsewhere) {
				const forward = { x: -Math.sin(marker.yaw), y: -Math.cos(marker.yaw) };
				context.beginPath();
				context.moveTo(x + forward.x * size * 0.7, y + forward.y * size * 0.7);
				context.lineTo(
					x + forward.x * size * 1.25,
					y + forward.y * size * 1.25,
				);
				context.strokeStyle = marker.color;
				context.lineWidth = 2.5;
				context.lineCap = "round";
				context.stroke();
				context.lineCap = "butt";
			}
		}
		if (elsewhere) {
			context.fillStyle = marker.color;
			context.font = `700 ${Math.round(size * 1.2)}px ${FIGURE_FONT}`;
			context.textAlign = "center";
			context.textBaseline = "middle";
			context.fillText(marker.level > view.level ? "↑" : "↓", x, y + 1);
		}
		if (options.names) {
			const fontSize = Math.round(Math.max(13, size * 1.2));
			context.font = `500 ${fontSize}px ${LABEL_FONT}`;
			const width = context.measureText(marker.name).width + 10;
			const top = y - size - fontSize - 8;
			context.fillStyle = COLORS.badge;
			context.fillRect(x - width / 2, top, width, fontSize + 4);
			context.fillStyle = marker.color;
			context.fillRect(x - width / 2, top + fontSize + 2, width, 2);
			context.textAlign = "center";
			context.textBaseline = "middle";
			context.fillStyle = "#efe3b8";
			context.fillText(marker.name, x, top + fontSize / 2 + 2);
		}
		context.globalAlpha = 1;
	}

	private drawViewCone(
		context: CanvasRenderingContext2D,
		x: number,
		y: number,
		yaw: number,
		radius: number,
	): void {
		const heading = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
		const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
		gradient.addColorStop(0, COLORS.cone);
		gradient.addColorStop(1, "rgba(220, 229, 77, 0)");
		context.beginPath();
		context.moveTo(x, y);
		context.arc(x, y, radius, heading - 0.6, heading + 0.6);
		context.closePath();
		context.fillStyle = gradient;
		context.fill();
	}

	private drawBadge(
		context: CanvasRenderingContext2D,
		text: string,
		x: number,
		y: number,
	): void {
		context.font = `500 13px ${LABEL_FONT}`;
		const width = context.measureText(text).width + 14;
		context.fillStyle = COLORS.badge;
		context.fillRect(x, y - 22, width, 22);
		context.fillStyle = COLORS.label;
		context.textAlign = "left";
		context.textBaseline = "middle";
		context.fillText(text, x + 7, y - 10.5);
	}

	private drawPlayer(
		context: CanvasRenderingContext2D,
		x: number,
		y: number,
		yaw: number,
		size: number,
	): void {
		const forward = { x: -Math.sin(yaw), y: -Math.cos(yaw) };
		const right = { x: -forward.y, y: forward.x };
		context.beginPath();
		context.moveTo(x + forward.x * size, y + forward.y * size);
		context.lineTo(
			x - forward.x * size * 0.6 + right.x * size * 0.6,
			y - forward.y * size * 0.6 + right.y * size * 0.6,
		);
		context.lineTo(x - forward.x * size * 0.25, y - forward.y * size * 0.25);
		context.lineTo(
			x - forward.x * size * 0.6 - right.x * size * 0.6,
			y - forward.y * size * 0.6 - right.y * size * 0.6,
		);
		context.closePath();
		context.fillStyle = COLORS.player;
		context.strokeStyle = "#0b0d0b";
		context.lineWidth = 2;
		context.fill();
		context.stroke();
	}

	private drawCompass(
		context: CanvasRenderingContext2D,
		x: number,
		y: number,
	): void {
		context.strokeStyle = "rgba(249, 229, 93, 0.7)";
		context.lineWidth = 2;
		context.beginPath();
		context.arc(x, y, 26, 0, Math.PI * 2);
		context.stroke();
		context.beginPath();
		context.moveTo(x, y - 22);
		context.lineTo(x + 7, y);
		context.lineTo(x, y + 22);
		context.lineTo(x - 7, y);
		context.closePath();
		context.fillStyle = "rgba(249, 229, 93, 0.25)";
		context.fill();
		context.beginPath();
		context.moveTo(x, y - 22);
		context.lineTo(x + 7, y);
		context.lineTo(x - 7, y);
		context.closePath();
		context.fillStyle = COLORS.label;
		context.fill();
		context.font = '700 16px "Barlow Condensed", sans-serif';
		context.textAlign = "center";
		context.fillText(currentMessages().game.map.north, x, y - 34);
	}

	private drawScaleBar(context: CanvasRenderingContext2D, view: MapView): void {
		const meters = view.scale > 30 ? 2 : view.scale > 12 ? 5 : 10;
		const length = meters * view.scale;
		const x = 24;
		const y = view.height - 28;
		context.fillStyle = COLORS.label;
		context.fillRect(x, y, length, 4);
		context.fillRect(x, y - 6, 2, 10);
		context.fillRect(x + length - 2, y - 6, 2, 10);
		context.font = '700 16px "Barlow Condensed", sans-serif';
		context.textAlign = "left";
		context.fillText(`${meters} m`, x, y - 12);
	}
}
