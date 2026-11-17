import { writeFile } from "node:fs/promises";
import path from "node:path";
import { exportEntities } from "./glb/exportEntities.js";
import { exportFurnitureModels } from "./glb/exportFurniture.js";
import { exportItemsAndWorld } from "./glb/exportItemsAndWorld.js";
import {
	createExportContext,
	type GlbReport,
} from "./glb/placeholderMaterials.js";

interface ManifestEntry {
	path: string;
	category: string;
	bytes: number;
	dynamicMaterials: string[];
	pivots: string[];
	bbox: GlbReport["bbox"];
}

function categoryOf(relPath: string): string {
	return relPath.split("/")[0] ?? "other";
}

async function main(): Promise<void> {
	const outRoot = path.resolve(process.argv[2] ?? "models");
	const ctx = await createExportContext();
	try {
		const furniture = await exportFurnitureModels(
			ctx,
			path.join(outRoot, "furniture"),
		);
		const entities = await exportEntities(ctx, outRoot);
		const items = await exportItemsAndWorld(ctx, outRoot);
		const allReports = [...furniture, ...entities, ...items];

		const entries: ManifestEntry[] = allReports.map((report) => {
			const relPath = path
				.relative(outRoot, report.outPath)
				.replaceAll("\\", "/");
			return {
				path: relPath,
				category: categoryOf(relPath),
				bytes: report.byteLength,
				dynamicMaterials: report.dynamicMaterials,
				pivots: report.pivots,
				bbox: report.bbox,
			};
		});

		await writeFile(
			path.join(outRoot, "manifest.json"),
			JSON.stringify(
				{
					generatedAt: new Date().toISOString(),
					totalModels: entries.length,
					models: entries,
				},
				null,
				"\t",
			),
			"utf8",
		);

		console.log(
			`Export GLB terminé : ${entries.length} modèles dans ${outRoot}`,
		);
	} finally {
		ctx.dispose();
	}
}

void main();
