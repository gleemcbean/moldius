import {
	SPECIES_LIST,
	type SpeciesDefinition,
	type SpeciesId,
} from "@shared/config/species";
import type { MatchInit } from "@shared/protocol/game";
import type * as THREE from "three";
import { soundBank } from "../audio/soundBank";
import { settingsStore } from "../settings/settingsStore";
import { createPageTexture, type GrimoireModel } from "./GrimoireModel";
import type { ObjectArt } from "./objectArt";
import {
	type FormulaEntry,
	PAGE_HEIGHT,
	PAGE_WIDTH,
	type PageContent,
	renderLeftPage,
	renderRightPage,
} from "./pageRenderer";

interface Page {
	species: SpeciesId;
	left: HTMLCanvasElement;
	right: HTMLCanvasElement;
	leftTexture: THREE.CanvasTexture;
	rightTexture: THREE.CanvasTexture;
	signature: string;
}

function canvas(): HTMLCanvasElement {
	const element = document.createElement("canvas");
	element.width = PAGE_WIDTH;
	element.height = PAGE_HEIGHT;
	return element;
}

export class GrimoireController {
	private readonly pages: Page[] = [];
	current = 0;
	private open = false;
	private unsubscribe: (() => void) | null = null;

	constructor(
		private readonly init: MatchInit,
		private readonly model: GrimoireModel,
		private readonly illustrations: Map<SpeciesId, HTMLCanvasElement>,
		private readonly objectArt: ObjectArt,
		private readonly anisotropy: number,
		private readonly isActive: (anomalyId: number) => boolean,
	) {}

	get isOpen(): boolean {
		return this.open;
	}

	async build(
		onProgress: (fraction: number) => void,
	): Promise<THREE.Texture[]> {
		const present = SPECIES_LIST.filter((species) =>
			this.init.pool.includes(species.id),
		);
		for (const species of present) {
			const left = canvas();
			const right = canvas();
			const page: Page = {
				species: species.id,
				left,
				right,
				leftTexture: createPageTexture(left, this.anisotropy),
				rightTexture: createPageTexture(right, this.anisotropy),
				signature: "",
			};
			renderLeftPage(left, this.content(page));
			this.renderRight(page, true);
			page.leftTexture.needsUpdate = true;
			this.pages.push(page);
			onProgress(this.pages.length / present.length);
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		const first = this.pages[0];
		this.model.setPages(first.leftTexture, first.rightTexture);
		this.unsubscribe = settingsStore.subscribe((state, previous) => {
			if (state.language !== previous.language) {
				this.rerender();
			}
		});
		return this.pages.flatMap((page) => [page.leftTexture, page.rightTexture]);
	}

	private content(page: Page): PageContent {
		const species = SPECIES_LIST.find(
			(entry) => entry.id === page.species,
		) as SpeciesDefinition;
		const specimens = this.init.roster.filter(
			(entry) => entry.species === page.species,
		);
		const formulas: FormulaEntry[] =
			specimens.length > 0
				? [
						{
							present: specimens.filter((entry) => this.isActive(entry.id))
								.length,
							count: specimens.length,
							words: specimens[0].formula,
						},
					]
				: [];
		return {
			occult: specimens[0]?.occult ?? null,
			art: this.objectArt,
			species,
			formulas,
			illustration: this.illustrations.get(page.species) ?? null,
		};
	}

	private rerender(): void {
		for (const page of this.pages) {
			renderLeftPage(page.left, this.content(page));
			page.leftTexture.needsUpdate = true;
			this.renderRight(page, true);
		}
	}

	private renderRight(page: Page, force = false): void {
		const content = this.content(page);
		const signature = JSON.stringify(
			content.formulas.map((formula) => formula.present),
		);
		if (!force && signature === page.signature) {
			return;
		}
		page.signature = signature;
		renderRightPage(page.right, content);
		page.rightTexture.needsUpdate = true;
	}

	setOpen(open: boolean): void {
		if (this.open !== open) {
			soundBank.play(open ? "book-open" : "hide", { volume: 0.5 });
		}
		this.open = open;
	}

	refresh(): void {
		const page = this.pages[this.current];
		if (page) {
			this.renderRight(page);
		}
	}

	goTo(index: number): void {
		const clamped = Math.max(0, Math.min(this.pages.length - 1, index));
		if (clamped === this.current || this.pages.length === 0) {
			return;
		}
		const direction: 1 | -1 = clamped > this.current ? 1 : -1;
		this.current = clamped;
		const page = this.pages[clamped];
		this.renderRight(page, true);
		this.model.flipTo(page.leftTexture, page.rightTexture, direction);
		soundBank.play("page-turn", { volume: 0.6 });
	}

	next(): void {
		this.goTo(this.current + 1);
	}

	previous(): void {
		this.goTo(this.current - 1);
	}

	dispose(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		for (const page of this.pages) {
			page.leftTexture.dispose();
			page.rightTexture.dispose();
		}
	}
}
