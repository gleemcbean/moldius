import * as THREE from "three";
import manifest from "../../../assets/textures/textures.json";
import { textureFile } from "./textureKeys";

const FILE_URLS = import.meta.glob<string>(
	"../../../assets/textures/**/*.png",
	{
		eager: true,
		query: "?url&no-inline",
		import: "default",
	},
);

const PREFIX = "../../../assets/textures/";
const LOAD_CONCURRENCY = 8;

export interface PixelSurfaceInfo {
	category: string;
	fine: false;
	size: number[];
	tile: number[];
	normal: boolean;
}

export interface FineSurfaceInfo {
	category: string;
	fine: true;
	size: number[];
	lowSize: number[];
	tile: number[];
	metallic: boolean;
	depth: number;
	parallax: boolean;
}

export type SurfaceInfo = PixelSurfaceInfo | FineSurfaceInfo;

export const SURFACES = manifest.surfaces as Record<string, SurfaceInfo>;
export const LOW_DETAIL = manifest.lowDetail;

export const SPECIAL_TEXTURES = manifest.special as Record<
	string,
	{ category: string; color: boolean }
>;

const urls = new Map(
	Object.entries(FILE_URLS).map(([file, url]) => [
		file.slice(PREFIX.length),
		url,
	]),
);

const images = new Map<string, Promise<HTMLImageElement>>();
const ready = new Map<string, HTMLImageElement>();
const queue: (() => void)[] = [];
const waiting = new Map<string, () => void>();
let running = 0;

function pump(): void {
	while (running < LOAD_CONCURRENCY && queue.length > 0) {
		running += 1;

		queue.shift()?.();
	}
}

function hurry(file: string): void {
	const job = waiting.get(file);
	const index = job ? queue.indexOf(job) : -1;

	if (job && index > 0) {
		queue.splice(index, 1);
		queue.unshift(job);
	}
}

function decode(
	file: string,
	url: string,
	priority: boolean,
): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const job = () => {
			waiting.delete(file);

			const image = new Image();

			image.decoding = "async";
			image.src = url;

			image
				.decode()
				.then(() => resolve(image), reject)
				.finally(() => {
					running -= 1;

					pump();
				});
		};

		waiting.set(file, job);

		if (priority) {
			queue.unshift(job);
		} else {
			queue.push(job);
		}

		pump();
	});
}

export function hasTextureFile(file: string): boolean {
	return urls.has(file);
}

export function loadedImage(file: string): HTMLImageElement | null {
	return ready.get(file) ?? null;
}

export function canLoadImages(): boolean {
	return typeof Image !== "undefined";
}

export function loadImage(
	file: string,
	priority = false,
): Promise<HTMLImageElement> {
	let pending = images.get(file);

	if (pending && priority) {
		hurry(file);
	}

	if (!pending) {
		const url = urls.get(file);

		if (!url) {
			return Promise.reject(new Error(`Texture introuvable : ${file}`));
		}

		if (!canLoadImages()) {
			return Promise.reject(new Error("Chargement d'images indisponible"));
		}

		pending = decode(file, url, priority).then((image) => {
			ready.set(file, image);

			return image;
		});

		images.set(file, pending);
	}

	return pending;
}

export function surfaceFiles(key: string, low: boolean): string[] {
	const info = SURFACES[key];

	if (!info) {
		return [];
	}

	const { category } = info;

	if (!info.fine) {
		const albedo = textureFile(category, key, "albedo");

		return info.normal
			? [albedo, textureFile(category, key, "normal")]
			: [albedo];
	}

	return [
		textureFile(category, key, "albedo", low),
		textureFile(category, key, "normal", low),
		textureFile(category, key, "orm", low),
	];
}

export function surfaceAlbedoFile(key: string): string {
	const info = SURFACES[key];

	if (!info) {
		throw new Error(`Texture inconnue : ${key}`);
	}

	return textureFile(info.category, key, "albedo");
}

function specialFile(key: string): string {
	const info = SPECIAL_TEXTURES[key];

	if (!info) {
		throw new Error(`Texture spéciale inconnue : ${key}`);
	}

	return textureFile(info.category, key, "albedo");
}

export function reflectionFiles(): string[] {
	return Array.from({ length: 6 }, (_, index) => `reflections/${index}.png`);
}

export function fillTexture(
	texture: THREE.Texture,
	file: string,
	priority = false,
): Promise<void> {
	const apply = (image: HTMLImageElement) => {
		texture.image = image;
		texture.needsUpdate = true;
	};

	const image = loadedImage(file);

	if (image) {
		apply(image);

		return Promise.resolve();
	}

	return loadImage(file, priority).then(apply);
}

let specials: Map<string, THREE.Texture> | null = null;

export function specialTexture(key: string): THREE.Texture {
	specials ??= new Map();

	let texture = specials.get(key);

	if (!texture) {
		const info = SPECIAL_TEXTURES[key];

		if (!info) {
			throw new Error(`Texture spéciale inconnue : ${key}`);
		}

		texture = new THREE.Texture();
		texture.name = key;
		texture.colorSpace = info.color ? THREE.SRGBColorSpace : THREE.NoColorSpace;

		if (canLoadImages()) {
			fillTexture(texture, specialFile(key)).catch((error: unknown) =>
				console.error(error),
			);
		}

		specials.set(key, texture);
	}

	return texture;
}

export function preloadSpecialTextures(priority = false): Promise<void> {
	if (!canLoadImages()) {
		return Promise.resolve();
	}

	return Promise.all(
		Object.keys(SPECIAL_TEXTURES).map((key) =>
			loadImage(specialFile(key), priority),
		),
	).then(() => undefined);
}
