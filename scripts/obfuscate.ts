import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JavaScriptObfuscator, {
	type ObfuscatorOptions,
} from "javascript-obfuscator";
import type { Plugin } from "vite";

const OPTIONS: ObfuscatorOptions = {
	advertisement: false,
	compact: true,
	controlFlowFlattening: false,
	deadCodeInjection: false,
	debugProtection: false,
	disableConsoleOutput: false,
	identifierNamesGenerator: "hexadecimal",
	ignoreImports: true,
	numbersToExpressions: false,
	renameGlobals: false,
	seed: 1,
	selfDefending: false,
	simplify: true,
	sourceMap: false,
	splitStrings: false,
	stringArray: true,
	stringArrayCallsTransform: false,
	stringArrayEncoding: [],
	stringArrayIndexShift: true,
	stringArrayRotate: true,
	stringArrayShuffle: true,
	stringArrayThreshold: 1,
	stringArrayWrappersCount: 0,
	target: "browser",
	transformObjectKeys: false,
	unicodeEscapeSequence: false,
};

function obfuscateCode(code: string): string {
	return JavaScriptObfuscator.obfuscate(code, OPTIONS).getObfuscatedCode();
}

export function obfuscate(vendorChunks: string[]): Plugin {
	const vendors = new Set(vendorChunks);
	let publicDir = "";
	return {
		name: "mycelium-obfuscate",
		apply: "build",
		configResolved(config) {
			publicDir = config.build.copyPublicDir ? config.publicDir : "";
		},
		generateBundle: {
			order: "post",
			handler(_options, bundle) {
				for (const file of Object.values(bundle)) {
					if (file.type === "chunk") {
						if (!vendors.has(file.name)) {
							file.code = obfuscateCode(file.code);
						}
					} else if (
						file.fileName.endsWith(".js") &&
						typeof file.source === "string"
					) {
						file.source = obfuscateCode(file.source);
					}
				}
			},
		},
		writeBundle: {
			order: "post",
			async handler(options) {
				if (!publicDir || !options.dir) {
					return;
				}
				for (const entry of await readdir(publicDir, { withFileTypes: true })) {
					if (!entry.isFile() || !entry.name.endsWith(".js")) {
						continue;
					}
					const target = join(options.dir, entry.name);
					await writeFile(
						target,
						obfuscateCode(await readFile(target, "utf8")),
					);
				}
			},
		},
	};
}
