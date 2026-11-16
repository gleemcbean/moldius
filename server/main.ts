import { startServer } from "./index.js";

startServer()
	.then((server) => {
		console.log(`Moldius : serveur prêt sur le port ${server.port}`);
	})
	.catch((error: unknown) => {
		console.error("Échec du démarrage du serveur", error);
		process.exitCode = 1;
	});
