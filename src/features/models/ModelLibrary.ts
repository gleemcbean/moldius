import * as THREE from "three";
import {
	GLTFLoader,
	type GLTFLoaderPlugin,
	type GLTFParser,
} from "three/addons/loaders/GLTFLoader.js";

const MODEL_URLS = import.meta.glob<string>("../../assets/models/**/*.glb", {
	eager: true,
	query: "?url&no-inline",
	import: "default",
});
const PREFIX = "../../assets/models/";
const LOAD_CONCURRENCY = 6;

export type ModelReader = (url: string) => Promise<ArrayBuffer>;

const URLS = new Map(
	Object.entries(MODEL_URLS).map(([file, url]) => [
		file.slice(PREFIX.length).replace(/\.glb$/, ""),
		url,
	]),
);

class SurfacePlugin implements GLTFLoaderPlugin {
	readonly name = "moldius_surfaces";

	constructor(private readonly parser: GLTFParser) {}

	loadMaterial(materialIndex: number): Promise<THREE.Material> | null {
		const definition = this.parser.json.materials?.[materialIndex];
		if (!definition?.extras?.surface) {
			return null;
		}
		const material = new THREE.MeshBasicMaterial();
		material.name = definition.name ?? "";
		material.userData = { ...definition.extras };
		return Promise.resolve(material);
	}
}

function prepareTemplate(root: THREE.Object3D): void {
	root.traverse((object) => {
		const data = object.userData as {
			hidden?: boolean;
			euler?: [number, number, number, THREE.EulerOrder];
			renderOrder?: number;
		};
		if (data.euler) {
			object.rotation.set(...data.euler);
		}
		if (data.hidden) {
			object.visible = false;
		}
		if (data.renderOrder !== undefined) {
			object.renderOrder = data.renderOrder;
		}
	});
}

async function fetchModel(url: string): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Modèle introuvable : ${url}`);
	}
	return response.arrayBuffer();
}

class ModelLibrary {
	private readonly templates = new Map<string, THREE.Object3D>();
	private readonly pending = new Map<string, Promise<void>>();
	private readonly queue: (() => void)[] = [];
	private readonly waiting = new Map<string, () => void>();
	private readonly loader = new GLTFLoader().register(
		(parser) => new SurfacePlugin(parser),
	);
	private running = 0;
	private reader: ModelReader = fetchModel;

	readonly ids = [...URLS.keys()].sort();

	setReader(reader: ModelReader): void {
		this.reader = reader;
	}

	get loaded(): boolean {
		return this.templates.size >= this.ids.length;
	}

	exists(id: string): boolean {
		return URLS.has(id);
	}

	has(id: string): boolean {
		return this.templates.has(id);
	}

	load(onProgress?: (fraction: number) => void): Promise<void> {
		return this.require(this.ids, onProgress);
	}

	require(
		ids: Iterable<string>,
		onProgress?: (fraction: number) => void,
		priority = false,
	): Promise<void> {
		const wanted = [...new Set(ids)].filter((id) => URLS.has(id));
		let done = 0;
		onProgress?.(wanted.length === 0 ? 1 : 0);
		return Promise.all(
			wanted.map((id) =>
				this.fetch(id, priority).then(() => {
					done += 1;
					onProgress?.(done / wanted.length);
				}),
			),
		).then(() => undefined);
	}

	private fetch(id: string, priority = false): Promise<void> {
		let task = this.pending.get(id);
		if (task && priority) {
			const job = this.waiting.get(id);
			const index = job ? this.queue.indexOf(job) : -1;
			if (job && index > 0) {
				this.queue.splice(index, 1);
				this.queue.unshift(job);
			}
		}
		if (!task) {
			task = new Promise<void>((resolve, reject) => {
				const job = () => {
					this.waiting.delete(id);
					this.parse(id)
						.then(resolve, reject)
						.finally(() => {
							this.running -= 1;
							this.pump();
						});
				};
				this.waiting.set(id, job);
				if (priority) {
					this.queue.unshift(job);
				} else {
					this.queue.push(job);
				}
				this.pump();
			}).catch((error: unknown) => {
				this.pending.delete(id);
				throw error;
			});
			this.pending.set(id, task);
		}
		return task;
	}

	private pump(): void {
		while (this.running < LOAD_CONCURRENCY && this.queue.length > 0) {
			this.running += 1;
			this.queue.shift()?.();
		}
	}

	private async parse(id: string): Promise<void> {
		const buffer = await this.reader(URLS.get(id) as string);
		const gltf = await this.loader.parseAsync(buffer, "");
		const root = gltf.scene.children[0] ?? gltf.scene;
		root.removeFromParent();
		prepareTemplate(root);
		this.templates.set(id, root);
	}

	template(id: string): THREE.Object3D {
		const template = this.templates.get(id);
		if (!template) {
			throw new Error(
				URLS.has(id)
					? `Modèle demandé avant chargement : ${id}`
					: `Modèle inconnu : ${id}`,
			);
		}
		return template;
	}
}

export const modelLibrary = new ModelLibrary();
