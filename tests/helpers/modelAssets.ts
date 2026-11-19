import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";

export const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const clientRoot = `${projectRoot}/src/features`;

interface ModelLibraryApi {
	setReader(reader: (url: string) => Promise<ArrayBuffer>): void;
	load(): Promise<void>;
	ids: string[];
	template(id: string): THREE.Object3D;
}

export interface ClientModels {
	library: ModelLibraryApi;
	kit: unknown;
	materials: unknown;
}

let cached: Promise<ClientModels> | null = null;

async function readAsset(url: string): Promise<ArrayBuffer> {
	const relative = decodeURIComponent(url.split("?")[0]).replace(/^\/+/, "");
	const buffer = await readFile(path.join(projectRoot, relative));
	return buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength,
	) as ArrayBuffer;
}

export function loadClientModels(): Promise<ClientModels> {
	cached ??= (async () => {
		const { modelLibrary } = (await import(
			`${clientRoot}/models/ModelLibrary.ts`
		)) as { modelLibrary: ModelLibraryApi };
		const { ModelKit } = (await import(`${clientRoot}/models/modelKit.ts`)) as {
			ModelKit: new (materials: unknown) => unknown;
		};
		const { TextureLibrary } = (await import(
			`${clientRoot}/world/textures/TextureLibrary.ts`
		)) as { TextureLibrary: new (anisotropy: number) => unknown };
		const { MaterialLibrary } = (await import(
			`${clientRoot}/world/MaterialLibrary.ts`
		)) as { MaterialLibrary: new (textures: unknown) => unknown };
		modelLibrary.setReader(readAsset);
		await modelLibrary.load();
		const materials = new MaterialLibrary(new TextureLibrary(1));
		return { library: modelLibrary, kit: new ModelKit(materials), materials };
	})();
	return cached;
}

export function meshCount(root: THREE.Object3D): number {
	let count = 0;
	root.traverse((object) => {
		if (object instanceof THREE.Mesh) {
			count += 1;
		}
	});
	return count;
}
