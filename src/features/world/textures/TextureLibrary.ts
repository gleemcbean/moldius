import * as THREE from "three";
import {
	canLoadImages,
	fillTexture,
	LOW_DETAIL,
	loadImage,
	reflectionFiles,
	SURFACES,
	surfaceFiles,
} from "./textureFiles";

export interface SurfaceQuality {
	detail: number;
	parallax: number;
}

export const DEFAULT_SURFACE_QUALITY: SurfaceQuality = {
	detail: 1,
	parallax: 16,
};

export interface SurfaceMaps {
	map: THREE.Texture;
	normalMap: THREE.Texture | null;
	ormMap: THREE.Texture | null;
	fine: boolean;
	metallic: boolean;
	depth: number;
	parallax: boolean;
}

export function isFineTexture(key: string): boolean {
	return SURFACES[key]?.fine === true;
}

export class TextureLibrary {
	private readonly surfaces = new Map<string, SurfaceMaps>();
	private readonly loading = new Set<Promise<void>>();
	private ambientReflections: THREE.CubeTexture | null = null;
	private disposed = false;

	constructor(
		private readonly anisotropy: number,
		readonly quality: SurfaceQuality = DEFAULT_SURFACE_QUALITY,
		private readonly priority = false,
	) {}

	get keys(): string[] {
		return Object.keys(SURFACES);
	}

	private get low(): boolean {
		return this.quality.detail <= LOW_DETAIL;
	}

	async prepare(
		keys: readonly string[] = this.keys,
		progress?: (fraction: number) => void,
	): Promise<void> {
		const files = [
			...keys.flatMap((key) => surfaceFiles(key, this.low)),
			...reflectionFiles(),
		];

		let done = 0;

		progress?.(0);

		await Promise.all(
			files.map((file) =>
				loadImage(file).then(() => {
					done += 1;

					progress?.(done / files.length);
				}),
			),
		);
	}

	surface(key: string, fixedRepeat = false): SurfaceMaps {
		const id = fixedRepeat ? `${key}#fixed` : key;
		const existing = this.surfaces.get(id);

		if (existing) {
			return existing;
		}

		const info = SURFACES[key];

		if (!info) {
			throw new Error(`Texture inconnue : ${key}`);
		}

		const [albedo, normal, orm] = surfaceFiles(key, this.low);
		const [tileX, tileY] = fixedRepeat ? [1, 1] : info.tile;

		const layer = (file: string | undefined, suffix: string, color: boolean) =>
			file
				? this.layer(file, `${key}${suffix}`, color, info.fine, tileX, tileY)
				: null;

		const created: SurfaceMaps = {
			map: layer(albedo, "", true) as THREE.Texture,
			normalMap: layer(normal, ":normal", false),
			ormMap: layer(orm, ":orm", false),
			fine: info.fine,
			metallic: info.fine && info.metallic,
			depth: info.fine ? info.depth : 0,
			parallax: info.fine && info.parallax,
		};

		this.surfaces.set(id, created);

		return created;
	}

	private layer(
		file: string,
		name: string,
		color: boolean,
		fine: boolean,
		tileX: number,
		tileY: number,
	): THREE.Texture {
		const texture = new THREE.Texture();

		texture.name = name;
		texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
		texture.magFilter = fine ? THREE.LinearFilter : THREE.NearestFilter;

		texture.minFilter = fine
			? THREE.LinearMipmapLinearFilter
			: THREE.NearestMipmapLinearFilter;

		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.anisotropy = this.anisotropy;

		texture.repeat.set(1 / tileX, 1 / tileY);

		if (canLoadImages()) {
			this.track(fillTexture(texture, file, this.priority));
		}

		return texture;
	}

	private track(task: Promise<void>): void {
		const tracked = task
			.catch((error: unknown) => {
				if (!this.disposed) {
					console.error(error);
				}
			})
			.finally(() => this.loading.delete(tracked));

		this.loading.add(tracked);
	}

	settled(): Promise<void> {
		return Promise.all([...this.loading]).then(() => undefined);
	}

	reflections(): THREE.CubeTexture | null {
		if (!this.ambientReflections && typeof document !== "undefined") {
			const texture = new THREE.CubeTexture();

			texture.colorSpace = THREE.SRGBColorSpace;
			texture.magFilter = THREE.NearestFilter;

			this.track(
				Promise.all(
					reflectionFiles().map((file) => loadImage(file, this.priority)),
				).then((faces) => {
					texture.images = faces;
					texture.needsUpdate = true;
				}),
			);

			this.ambientReflections = texture;
		}

		return this.ambientReflections;
	}

	build(key: string): THREE.Texture {
		return this.surface(key).map;
	}

	get(key: string): THREE.Texture {
		return this.surface(key).map;
	}

	all(): THREE.Texture[] {
		return [...this.surfaces.values()].flatMap((surface) =>
			[surface.map, surface.normalMap, surface.ormMap].filter(
				(texture): texture is THREE.Texture => texture !== null,
			),
		);
	}

	dispose(): void {
		this.disposed = true;

		for (const texture of this.all()) {
			texture.dispose();
		}

		this.ambientReflections?.dispose();

		this.ambientReflections = null;

		this.surfaces.clear();
	}
}
