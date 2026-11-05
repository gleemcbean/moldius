import { fileURLToPath, URL } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { lanReport } from "./scripts/lanNetwork.mjs";

const backendPort = Number(process.env.PORT ?? 3001);
const backend = `http://127.0.0.1:${backendPort}`;
const lan = process.env.MYCELIUM_LAN === "true";

const lanUrls: Plugin = {
	name: "mycelium-lan-urls",
	configureServer(server) {
		server.printUrls = () => {
			server.config.logger.info(
				[
					"",
					"  MOLDIUS sur le réseau local (certificat auto-signé : acceptez l'avertissement du navigateur)",
					...lanReport().map((line) => `  ➜  ${line}`),
					"",
				].join("\n"),
			);
		};
	},
};

export default defineConfig({
	plugins: [
		react(),
		...(lan ? [basicSsl({ name: "mycelium-lan" }), lanUrls] : []),
	],
	resolve: {
		alias: {
			"@shared": fileURLToPath(new URL("./shared", import.meta.url)),
		},
	},
	css: {
		modules: {
			localsConvention: "camelCaseOnly",
		},
	},
	server: {
		port: 5173,
		host: lan ? "0.0.0.0" : "localhost",
		watch: {
			ignored: ["**/.dev-mail/**", "**/.dev-postgres/**", "**/release/**"],
		},
		proxy: {
			"/socket.io": { target: backend, ws: true, xfwd: true },
			"/api": { target: backend, changeOrigin: false, xfwd: true },
			"/download": { target: backend, xfwd: true },
		},
	},
	worker: {
		format: "es",
	},
	build: {
		outDir: "dist",
		sourcemap: true,
		chunkSizeWarningLimit: 800,
		rollupOptions: {
			output: {
				manualChunks: {
					three: ["three"],
					react: ["react", "react-dom", "react-dom/client"],
					network: ["socket.io-client"],
				},
			},
		},
	},
});
