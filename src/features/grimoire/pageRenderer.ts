import {
	type MaterialId,
	OCCULT_RECIPES,
	type OccultId,
} from "@shared/config/occult";
import type { SpeciesDefinition } from "@shared/config/species";
import { hashString, SeededRandom } from "@shared/random";
import { currentMessages } from "../../i18n";
import type { ObjectArt } from "./objectArt";

export const PAGE_WIDTH = 768;
export const PAGE_HEIGHT = 1024;

const INK = "#2a1a0e";
const INK_SOFT = "#5a3f22";
const RED_INK = "#5e0905";
const HAND_FONT = '"IM Fell English", "IM Fell English SC", Georgia, serif';
const TITLE_FONT = '"IM Fell English SC", "IM Fell English", Georgia, serif';
const NAME_MAX_WIDTH = PAGE_WIDTH - 120;
const HERO_ART_SIZE = 200;
const MATERIAL_ART_SIZE = 150;

export interface FormulaEntry {
	present: number;
	count: number;
	words: string[];
}

export interface PageContent {
	occult: OccultId | null;
	art: ObjectArt;
	species: SpeciesDefinition;
	formulas: FormulaEntry[];
	illustration: HTMLCanvasElement | null;
}

export async function ensurePageFonts(): Promise<void> {
	if (!document.fonts) {
		return;
	}
	await Promise.all([
		document.fonts.load(`400 32px ${HAND_FONT}`),
		document.fonts.load(`italic 400 32px ${HAND_FONT}`),
		document.fonts.load(`400 32px ${TITLE_FONT}`),
	]).catch(() => undefined);
}

function parchment(
	context: CanvasRenderingContext2D,
	seed: number,
	mirrored: boolean,
): void {
	const rng = new SeededRandom(seed);
	const gradient = context.createLinearGradient(
		mirrored ? PAGE_WIDTH : 0,
		0,
		mirrored ? 0 : PAGE_WIDTH,
		0,
	);
	gradient.addColorStop(0, "#b89a66");
	gradient.addColorStop(0.08, "#e3d0a2");
	gradient.addColorStop(0.6, "#ead9ae");
	gradient.addColorStop(1, "#dcc48e");
	context.fillStyle = gradient;
	context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
	const block = 8;
	for (let y = 0; y < PAGE_HEIGHT; y += block) {
		for (let x = 0; x < PAGE_WIDTH; x += block) {
			const value = rng.next();
			if (value < 0.35) {
				context.fillStyle = `rgba(110, 80, 40, ${0.02 + rng.next() * 0.05})`;
				context.fillRect(x, y, block, block);
			}
		}
	}
	for (let index = 0; index < 6; index += 1) {
		const x = rng.range(0, PAGE_WIDTH);
		const y = rng.range(0, PAGE_HEIGHT);
		const radius = rng.range(20, 70);
		const stain = context.createRadialGradient(x, y, 0, x, y, radius);
		stain.addColorStop(0, "rgba(120, 80, 30, 0.12)");
		stain.addColorStop(1, "rgba(120, 80, 30, 0)");
		context.fillStyle = stain;
		context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
	}
	context.strokeStyle = "rgba(90, 60, 25, 0.55)";
	context.lineWidth = 4;
	context.strokeRect(34, 34, PAGE_WIDTH - 68, PAGE_HEIGHT - 68);
	context.lineWidth = 1.5;
	context.strokeRect(44, 44, PAGE_WIDTH - 88, PAGE_HEIGHT - 88);
}

function wrapLines(
	context: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (context.measureText(candidate).width > maxWidth && current) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
	}
	if (current) {
		lines.push(current);
	}
	return lines;
}

function drawParagraph(
	context: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number,
	bold = false,
): number {
	let cursor = y;
	if (bold) {
		context.strokeStyle = context.fillStyle;
		context.lineWidth = 1.4;
		context.lineJoin = "round";
	}
	for (const line of wrapLines(context, text, maxWidth)) {
		if (bold) {
			context.strokeText(line, x, cursor);
		}
		context.fillText(line, x, cursor);
		cursor += lineHeight;
	}
	return cursor;
}

function heading(
	context: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
): number {
	context.font = `400 42px ${TITLE_FONT}`;
	context.fillStyle = RED_INK;
	context.strokeStyle = RED_INK;
	context.lineWidth = 1.2;
	context.strokeText(text, x, y);
	context.fillText(text, x, y);
	context.fillRect(x, y + 10, context.measureText(text).width, 3);
	return y + 54;
}

export function renderLeftPage(
	canvas: HTMLCanvasElement,
	content: PageContent,
): void {
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	parchment(context, hashString(`${content.species.id}-left`), false);
	const { species } = content;
	const labels = currentMessages().grimoire;
	const text = labels.species[species.id];
	context.textBaseline = "alphabetic";
	context.textAlign = "center";
	context.fillStyle = INK;
	let size = 80;
	context.font = `400 ${size}px ${TITLE_FONT}`;
	while (size > 36 && context.measureText(text.name).width > NAME_MAX_WIDTH) {
		size -= 2;
		context.font = `400 ${size}px ${TITLE_FONT}`;
	}
	context.fillText(text.name, PAGE_WIDTH / 2, 150);
	const pictureTop = 190;
	const pictureSize = 580;
	if (content.illustration) {
		context.drawImage(
			content.illustration,
			(PAGE_WIDTH - pictureSize) / 2,
			pictureTop,
			pictureSize,
			pictureSize,
		);
	}
	context.font = `400 64px ${TITLE_FONT}`;
	context.fillStyle = RED_INK;
	context.fillText(
		labels.points(species.points),
		PAGE_WIDTH / 2,
		pictureTop + pictureSize + 80,
	);
	context.font = `italic 400 32px ${HAND_FONT}`;
	context.fillStyle = INK_SOFT;
	context.fillText(
		labels.inPool,
		PAGE_WIDTH / 2,
		pictureTop + pictureSize + 130,
	);
	context.textAlign = "left";
}

export function renderRightPage(
	canvas: HTMLCanvasElement,
	content: PageContent,
): void {
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	parchment(context, hashString(`${content.species.id}-right`), true);
	const { species } = content;
	const labels = currentMessages().grimoire;
	const margin = 76;
	const width = PAGE_WIDTH - margin * 2;
	context.textAlign = "left";
	context.textBaseline = "alphabetic";
	let y = 110;
	y = heading(context, labels.occultHeading, margin, y);
	if (content.occult) {
		y = drawRecipe(context, content, content.occult, margin, y, width) + 10;
	}
	y = heading(context, labels.capture, margin, y);
	context.font = `400 31px ${HAND_FONT}`;
	context.fillStyle = INK;
	for (const criterion of labels.criteria(species.capture)) {
		context.fillText("✦", margin, y);
		y = drawParagraph(context, criterion, margin + 34, y, width - 34, 36) + 2;
	}
	y += 14;
	y = heading(context, labels.incantation, margin, y);
	drawFormulas(context, content, margin, y, width);
}

function drawRecipe(
	context: CanvasRenderingContext2D,
	content: PageContent,
	occult: OccultId,
	x: number,
	y: number,
	width: number,
): number {
	const labels = currentMessages().grimoire;
	const hero = content.art.get(occult);
	if (hero) {
		context.drawImage(hero, x, y - 14, HERO_ART_SIZE, HERO_ART_SIZE);
	}
	context.font = `400 46px ${TITLE_FONT}`;
	context.fillStyle = INK;
	drawParagraph(
		context,
		labels.objects[occult],
		x + HERO_ART_SIZE + 14,
		y + 70,
		width - HERO_ART_SIZE - 14,
		50,
	);
	const recipe = Object.entries(OCCULT_RECIPES[occult]) as [
		MaterialId,
		number,
	][];
	const slot = width / recipe.length;
	const top = y + HERO_ART_SIZE - 18;
	let bottom = top;
	recipe.forEach(([id, count], index) => {
		const left = x + slot * index;
		const art = content.art.get(id);
		if (art) {
			context.drawImage(art, left, top, MATERIAL_ART_SIZE, MATERIAL_ART_SIZE);
		}
		context.font = `400 44px ${TITLE_FONT}`;
		context.fillStyle = RED_INK;
		context.fillText(`${count} ×`, left + 2, top + MATERIAL_ART_SIZE + 38);
		context.font = `400 27px ${HAND_FONT}`;
		context.fillStyle = INK;
		bottom = Math.max(
			bottom,
			drawParagraph(
				context,
				labels.materials[id],
				left + 2,
				top + MATERIAL_ART_SIZE + 72,
				slot - 10,
				30,
			),
		);
	});
	return bottom;
}

function drawFormulas(
	context: CanvasRenderingContext2D,
	content: PageContent,
	x: number,
	y: number,
	width: number,
): void {
	const labels = currentMessages().grimoire;
	const shown = content.formulas.slice(0, 1);
	if (shown.length === 0) {
		context.font = `italic 400 30px ${HAND_FONT}`;
		context.fillStyle = INK_SOFT;
		drawParagraph(context, labels.aimToReveal, x, y, width, 36);
		return;
	}
	let cursor = y + 14;
	for (const formula of shown) {
		const size = 58;
		context.font = `400 ${size}px ${TITLE_FONT}`;
		context.fillStyle = INK;
		const words = formula.words.map(
			(word) => word.charAt(0).toUpperCase() + word.slice(1),
		);
		const line1 = words.slice(0, 2).join("  ·  ");
		const line2 = words.slice(2).join("  ·  ");
		context.fillText(line1, x, cursor);
		cursor += size + 10;
		context.fillText(line2, x, cursor);
		cursor += size + 18;
	}
}
