import * as THREE from "three";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	BRASS,
	box,
	boxAt,
	CERAMIC,
	cylinder,
	cylinderBetween,
	DARK,
	type FurnitureBuilder,
	GLASS,
	IRON,
	type Part,
	type PartAnimation,
	pickWood,
	sphere,
	texturedPlane,
} from "./parts";

const PANEL = 0.04;

function hollowCabinet(
	material: MaterialOptions,
	width: number,
	height: number,
	depth: number,
	inner: MaterialOptions,
): Part[] {
	return [
		box(material, width, PANEL, depth, 0, 0, 0),
		box(material, width, PANEL, depth, 0, height - PANEL, 0),
		box(material, PANEL, height, depth, -width / 2 + PANEL / 2, 0, 0),
		box(material, PANEL, height, depth, width / 2 - PANEL / 2, 0, 0),
		box(
			inner,
			width - PANEL * 2,
			height - PANEL * 2,
			PANEL,
			0,
			PANEL,
			-depth / 2 + PANEL / 2,
		),
	];
}

function door(
	material: MaterialOptions,
	width: number,
	height: number,
	hingeX: number,
	z: number,
	y: number,
	angle: number,
	hingeOnLeft: boolean,
): Part[] {
	const direction = hingeOnLeft ? 1 : -1;
	const centerX = hingeX + Math.cos(angle) * (width / 2) * direction;
	const centerZ = z + Math.sin(angle) * (width / 2);
	const rotation = -angle * direction;
	const parts: Part[] = [
		boxAt(
			material,
			width,
			height,
			0.03,
			centerX,
			y + height / 2,
			centerZ,
			0,
			rotation,
		),
		boxAt(
			{ ...material, color: 0xd8d0c0 },
			width * 0.7,
			height * 0.35,
			0.01,
			centerX,
			y + height * 0.68,
			centerZ + 0.016 * Math.cos(angle),
			0,
			rotation,
		),
		boxAt(
			{ ...material, color: 0xd8d0c0 },
			width * 0.7,
			height * 0.35,
			0.01,
			centerX,
			y + height * 0.28,
			centerZ + 0.016 * Math.cos(angle),
			0,
			rotation,
		),
	];
	const knobX = hingeX + Math.cos(angle) * (width - 0.06) * direction;
	const knobZ = z + Math.sin(angle) * (width - 0.06) + 0.03;
	parts.push(sphere(BRASS, 0.018, knobX, y + height * 0.5, knobZ));
	return parts;
}

export const wardrobe: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const inner: MaterialOptions = {
		texture: "woodDark",
		color: 0x8a7a6a,
		roughness: 0.95,
	};
	const { width, height, depth } = item;
	const bodyHeight = height - 0.12;
	const parts = hollowCabinet(wood, width, bodyHeight, depth, inner);
	parts.push(
		box(wood, width + 0.06, 0.08, depth + 0.05, 0, height - 0.12, 0, 0, 0.02),
	);
	parts.push(
		box(wood, width + 0.1, 0.04, depth + 0.07, 0, height - 0.04, 0, 0, 0.015),
	);
	for (const side of [-1, 1]) {
		parts.push(
			cylinder(
				wood,
				0.035,
				0.025,
				0.1,
				side * (width / 2 - 0.06),
				-0.0,
				depth / 2 - 0.06,
				8,
			),
		);
	}
	const doorWidth = width / 2 - 0.01;
	const front = depth / 2 - 0.015;
	parts.push(
		...door(
			wood,
			doorWidth,
			bodyHeight - 0.1,
			width / 2 - 0.005,
			front,
			0.05,
			0,
			false,
		),
	);
	parts.push(
		...door(
			wood,
			doorWidth,
			bodyHeight - 0.1,
			-width / 2 + 0.005,
			front,
			0.05,
			0.42 + rng.next() * 0.12,
			true,
		),
	);
	parts.push(
		cylinderBetween(
			IRON,
			new THREE.Vector3(-width / 2 + 0.05, bodyHeight - 0.25, 0),
			new THREE.Vector3(width / 2 - 0.05, bodyHeight - 0.25, 0),
			0.012,
		),
	);
	const clothes = [0x3a2a4a, 0x5a2a1e, 0x2a3a2a, 0x1e2a3a];
	for (let index = 0; index < 3; index += 1) {
		const x = width * 0.18 + index * 0.13 - width * 0.05;
		parts.push(
			box(
				{
					texture: "linen",
					color: clothes[(index + item.variant) % clothes.length],
					roughness: 1,
				},
				0.05,
				0.85,
				depth * 0.55,
				x,
				bodyHeight - 1.12,
				0,
			),
		);
	}
	return parts;
};

export const lockers: FurnitureBuilder = ({ item, rng }) => {
	const paint: MaterialOptions = {
		texture: "iron",
		color: rng.pick([0x5f7a5a, 0x5a6a7a, 0x7a6a4a]),
		roughness: 0.6,
		metalness: 0.15,
	};
	const inner: MaterialOptions = {
		texture: "iron",
		color: 0x6a6a66,
		roughness: 0.85,
		metalness: 0.05,
	};
	const { width, height, depth } = item;
	const parts = hollowCabinet(paint, width, height, depth, inner);
	const count = width > 1.2 ? 3 : 2;
	const cell = width / count;
	for (let index = 1; index < count; index += 1) {
		parts.push(
			box(
				paint,
				0.02,
				height - PANEL * 2,
				depth - 0.02,
				-width / 2 + index * cell,
				PANEL,
				0,
			),
		);
	}
	for (let index = 0; index < count; index += 1) {
		const hingeX = -width / 2 + index * cell + 0.01;
		const angle = index === 0 ? 0.62 : 0;
		parts.push(
			...door(
				paint,
				cell - 0.03,
				height - 0.12,
				hingeX,
				depth / 2 - 0.015,
				0.06,
				angle,
				true,
			),
		);
		for (let slot = 0; slot < 4; slot += 1) {
			parts.push(
				boxAt(
					DARK,
					cell * 0.5,
					0.012,
					0.01,
					hingeX + cell * 0.5 * Math.cos(angle),
					height - 0.3 - slot * 0.05,
					depth / 2 + 0.005 + Math.sin(angle) * cell * 0.5,
					0,
					-angle,
				),
			);
		}
	}
	return parts;
};

export const confessional: FurnitureBuilder = ({ item }) => {
	const wood: MaterialOptions = { texture: "woodDark", roughness: 0.85 };
	const { width, height, depth } = item;
	const parts = hollowCabinet(wood, width, height - 0.25, depth, {
		texture: "woodDark",
		color: 0x7a6a5a,
	});
	parts.push(
		box(wood, width + 0.12, 0.12, depth + 0.1, 0, height - 0.25, 0, 0, 0.02),
	);
	parts.push(
		box(wood, width * 0.5, 0.13, 0.08, 0, height - 0.13, depth / 2 - 0.05),
	);
	parts.push(
		boxAt(
			{ texture: "velvetRed", roughness: 1 },
			width * 0.32,
			height - 0.5,
			0.03,
			-width * 0.28,
			(height - 0.3) / 2 + 0.05,
			depth / 2 - 0.03,
			0,
			0.18,
		),
	);
	parts.push(
		boxAt(
			{ texture: "velvetRed", roughness: 1 },
			width * 0.18,
			height - 0.5,
			0.03,
			width * 0.38,
			(height - 0.3) / 2 + 0.05,
			depth / 2 - 0.03,
		),
	);
	parts.push(
		cylinderBetween(
			BRASS,
			new THREE.Vector3(-width / 2 + 0.05, height - 0.42, depth / 2 - 0.02),
			new THREE.Vector3(width / 2 - 0.05, height - 0.42, depth / 2 - 0.02),
			0.012,
		),
	);
	return parts;
};

export const bookcase: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const parts = hollowCabinet(wood, width, height, depth, {
		...wood,
		color: 0x9a8a7a,
	});
	const shelves = Math.max(4, Math.round(height / 0.42));
	const spacing = (height - 0.1) / shelves;
	for (let index = 1; index < shelves; index += 1) {
		parts.push(
			box(wood, width - PANEL * 2, 0.025, depth - 0.03, 0, index * spacing, 0),
		);
	}
	for (let index = 0; index < shelves; index += 1) {
		const y = index * spacing + 0.03;
		const fill = 0.6 + rng.next() * 0.35;
		const booksWidth = (width - PANEL * 2 - 0.04) * fill;
		parts.push(
			texturedPlane(
				{ texture: "books", roughness: 0.9 },
				booksWidth,
				spacing * 0.8,
				-width / 2 + PANEL + 0.02 + booksWidth / 2,
				y + spacing * 0.4,
				depth / 2 - 0.06,
			),
		);
		parts.push(
			box(
				{ color: 0x2a1a12, roughness: 1 },
				booksWidth,
				spacing * 0.78,
				depth - 0.12,
				-width / 2 + PANEL + 0.02 + booksWidth / 2,
				y,
				-0.02,
			),
		);
		if (rng.chance(0.35)) {
			parts.push(
				box(
					{ texture: "books", roughness: 0.9 },
					0.22,
					0.04,
					depth * 0.6,
					width / 2 - PANEL - 0.15,
					y,
					0,
				),
			);
		}
	}
	parts.push(
		box(wood, width + 0.05, 0.06, depth + 0.04, 0, height - 0.02, 0, 0, 0.015),
	);
	return parts;
};

export const shelf: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [];
	for (const side of [-1, 1]) {
		parts.push(box(wood, 0.04, height, depth, side * (width / 2 - 0.02), 0, 0));
	}
	const levels = 4;
	for (let index = 0; index < levels; index += 1) {
		const y = 0.08 + index * ((height - 0.15) / (levels - 1));
		parts.push(box(wood, width - 0.08, 0.025, depth, 0, y, 0));
		let x = -width / 2 + 0.1;
		while (x < width / 2 - 0.15) {
			const choice = rng.int(0, 3);
			if (choice === 0) {
				parts.push(cylinder(CERAMIC, 0.05, 0.06, 0.16, x, y + 0.025, 0, 10));
			} else if (choice === 1) {
				parts.push(
					box(
						{ texture: "burlap", roughness: 1 },
						0.16,
						0.14,
						depth * 0.7,
						x,
						y + 0.025,
						0,
					),
				);
			} else if (choice === 2) {
				parts.push(
					cylinder(
						{
							...GLASS,
							color: rng.pick([0x5a8a3a, 0x8a3a5a, 0x3a5a8a]),
							opacity: 0.6,
						},
						0.035,
						0.04,
						0.2,
						x,
						y + 0.025,
						0,
						10,
					),
				);
			}
			x += 0.16 + rng.next() * 0.1;
		}
	}
	return parts;
};

export const potionShelf: FurnitureBuilder = (context) => {
	const parts = shelf(context);
	const { item, rng } = context;
	for (let index = 0; index < 10; index += 1) {
		const x = (rng.next() - 0.5) * (item.width - 0.2);
		const y = 0.1 + rng.int(0, 3) * ((item.height - 0.15) / 3);
		const color = rng.pick([0x6dff7a, 0xff4fd8, 0x4fa8ff, 0xffb84f]);
		parts.push(
			sphere(
				{
					...GLASS,
					color,
					opacity: 0.7,
					emissive: color,
					emissiveIntensity: 0.25,
				},
				0.045,
				x,
				y + 0.07,
				0.02,
			),
		);
		parts.push(cylinder(GLASS, 0.012, 0.012, 0.05, x, y + 0.11, 0.02, 6));
	}
	return parts;
};

export const cabinet: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width, height - 0.12, depth - 0.02, 0, 0.1, -0.01, 0, 0.02),
		box(wood, width + 0.05, 0.04, depth + 0.03, 0, height - 0.04, 0, 0, 0.012),
	];
	for (const side of [-1, 1]) {
		for (const back of [-1, 1]) {
			parts.push(
				cylinder(
					wood,
					0.03,
					0.022,
					0.1,
					side * (width / 2 - 0.06),
					0,
					back * (depth / 2 - 0.06),
					8,
				),
			);
		}
	}
	const doors = Math.max(2, Math.round(width / 0.5));
	const doorWidth = (width - 0.06) / doors;
	for (let index = 0; index < doors; index += 1) {
		const x = -width / 2 + 0.03 + doorWidth * (index + 0.5);
		parts.push(
			box(
				{ ...wood, color: 0xd8cfc0 },
				doorWidth - 0.03,
				height - 0.3,
				0.015,
				x,
				0.18,
				depth / 2 - 0.005,
			),
		);
		parts.push(
			sphere(
				BRASS,
				0.015,
				x + (index % 2 === 0 ? doorWidth * 0.35 : -doorWidth * 0.35),
				height * 0.6,
				depth / 2 + 0.012,
			),
		);
	}
	return parts;
};

export const dresser: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width, height - 0.06, depth - 0.02, 0, 0.06, -0.01, 0, 0.02),
		box(wood, width + 0.04, 0.035, depth + 0.02, 0, height - 0.035, 0),
	];
	const drawers = 3;
	const drawerHeight = (height - 0.16) / drawers;
	for (let index = 0; index < drawers; index += 1) {
		const y = 0.09 + index * drawerHeight;
		parts.push(
			box(
				{ ...wood, color: 0xd8cfc0 },
				width - 0.08,
				drawerHeight - 0.03,
				0.02,
				0,
				y,
				depth / 2 - 0.005,
			),
		);
		for (const side of [-1, 1]) {
			parts.push(
				sphere(
					BRASS,
					0.014,
					side * width * 0.22,
					y + drawerHeight / 2,
					depth / 2 + 0.015,
				),
			);
		}
	}
	return parts;
};

export const nightstand: FurnitureBuilder = (context) => dresser(context);

export const fileCabinet: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [box(wood, width, height, depth, 0, 0, 0, 0, 0.015)];
	const rows = 4;
	const columns = width > 0.7 ? 2 : 1;
	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const x = -width / 2 + (width / columns) * (column + 0.5);
			const y = 0.05 + row * ((height - 0.1) / rows);
			parts.push(
				box(
					{ ...wood, color: 0xe0d8c8 },
					width / columns - 0.05,
					(height - 0.1) / rows - 0.03,
					0.015,
					x,
					y,
					depth / 2,
				),
			);
			parts.push(box(BRASS, 0.08, 0.025, 0.02, x, y + 0.12, depth / 2 + 0.012));
			parts.push(
				box(CERAMIC, 0.06, 0.03, 0.005, x, y + 0.16, depth / 2 + 0.01),
			);
		}
	}
	return parts;
};

export const chest: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width, height * 0.7, depth, 0, 0, 0, 0, 0.02),
	];
	const lid = new THREE.CylinderGeometry(
		depth / 2,
		depth / 2,
		width,
		14,
		1,
		false,
		0,
		Math.PI,
	);
	lid.rotateZ(Math.PI / 2);
	lid.scale(1, (height * 0.3) / (depth / 2), 1);
	lid.translate(0, height * 0.7, 0);
	parts.push({ geometry: lid, material: wood });
	for (const x of [-width / 2 + 0.08, width / 2 - 0.08]) {
		parts.push(box(IRON, 0.04, height * 0.72, depth + 0.012, x, 0, 0));
	}
	parts.push(box(BRASS, 0.08, 0.1, 0.02, 0, height * 0.55, depth / 2 + 0.006));
	return parts;
};

export const wineRack: FurnitureBuilder = ({ item, rng }) => {
	const wood: MaterialOptions = { texture: "woodDark", roughness: 0.9 };
	const { width, height, depth } = item;
	const parts: Part[] = [];
	for (const side of [-1, 1]) {
		parts.push(
			box(wood, 0.05, height, depth, side * (width / 2 - 0.025), 0, 0),
		);
	}
	const rows = Math.floor(height / 0.2);
	const columns = Math.floor((width - 0.1) / 0.12);
	for (let row = 0; row < rows; row += 1) {
		parts.push(box(wood, width - 0.1, 0.02, depth, 0, row * 0.2, 0));
		for (let column = 0; column < columns; column += 1) {
			if (rng.chance(0.25)) {
				continue;
			}
			const x = -width / 2 + 0.11 + column * 0.12;
			const bottle = new THREE.CylinderGeometry(0.035, 0.035, depth * 0.85, 8);
			bottle.rotateX(Math.PI / 2);
			bottle.translate(x, row * 0.2 + 0.06, 0);
			parts.push({
				geometry: bottle,
				material: {
					...GLASS,
					color: rng.pick([0x1e3a1e, 0x3a1e1e, 0x2a2a14]),
					opacity: 0.85,
				},
			});
		}
	}
	return parts;
};

export const toolRack: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height } = item;
	const parts: Part[] = [
		box(wood, width, height * 0.75, 0.04, 0, height * 0.2, -0.08),
	];
	for (const side of [-1, 1]) {
		parts.push(
			box(wood, 0.06, height, 0.06, side * (width / 2 - 0.03), 0, -0.07),
		);
	}
	for (let index = 0; index < 6; index += 1) {
		const x = -width / 2 + 0.15 + index * ((width - 0.3) / 5);
		const top = height * (0.55 + rng.next() * 0.3);
		parts.push(
			cylinderBetween(
				wood,
				new THREE.Vector3(x, top, -0.03),
				new THREE.Vector3(x, top - 0.5, -0.03),
				0.015,
			),
		);
		parts.push(box(IRON, 0.1, 0.06, 0.025, x, top - 0.02, -0.03));
	}
	return parts;
};

export const grandfatherClock: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const pendulum: PartAnimation = {
		kind: "swing",
		pivot: [0, height - 0.57, depth * 0.47],
		axis: [0, 0, 1],
		speed: Math.PI,
		amplitude: 0.1,
		phase: rng.next() * Math.PI * 2,
	};
	return [
		box(wood, width, 0.35, depth, 0, 0, 0, 0, 0.02),
		box(wood, width * 0.75, height - 0.85, depth * 0.85, 0, 0.35, 0, 0, 0.015),
		box(wood, width, 0.5, depth, 0, height - 0.5, 0, 0, 0.02),
		texturedPlane(
			{ texture: "ceramic", roughness: 0.4 },
			width * 0.6,
			width * 0.6,
			0,
			height - 0.26,
			depth / 2 + 0.005,
		),
		boxAt(
			DARK,
			0.01,
			width * 0.22,
			0.01,
			0,
			height - 0.22,
			depth / 2 + 0.012,
			0,
			0,
			0.6,
		),
		boxAt(
			DARK,
			0.01,
			width * 0.16,
			0.01,
			0,
			height - 0.24,
			depth / 2 + 0.012,
			0,
			0,
			-1.2,
		),
		box(GLASS, width * 0.5, height - 1.0, 0.01, 0, 0.45, depth * 0.43),
		...[
			cylinder(BRASS, 0.012, 0.012, height - 1.32, 0, 0.75, depth * 0.47, 6),
			boxAt(BRASS, 0.13, 0.13, 0.02, 0, 0.75, depth * 0.47, 0, 0, Math.PI / 4),
		].map((part) => ({ ...part, animation: pendulum })),
	];
};
