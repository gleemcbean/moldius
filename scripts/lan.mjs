import {
	closeCommands,
	FIREWALL_RULE,
	firewallRuleExists,
	isWsl,
	LAN_PORT,
	lanReport,
	openCommands,
	portProxyTarget,
	runElevated,
	wslAddress,
	wslNetworkingMode,
} from "./lanNetwork.mjs";

const action = process.argv[2] ?? "status";

function printStatus() {
	if (isWsl()) {
		const mode = wslNetworkingMode();
		const target = portProxyTarget();
		console.log(
			`Réseau WSL : ${mode === "mirrored" ? "miroir" : "NAT"} (adresse WSL ${wslAddress() ?? "inconnue"})`,
		);
		if (mode !== "mirrored") {
			console.log(
				`Redirection Windows 0.0.0.0:${LAN_PORT} : ${target ? `→ ${target.address}:${target.port}` : "aucune"}`,
			);
		}
		console.log(
			`Règle de pare-feu « ${FIREWALL_RULE} » : ${firewallRuleExists() ? "présente" : "absente"}`,
		);
	}
	for (const line of lanReport()) {
		console.log(line);
	}
}

function elevate(commands, label) {
	console.log(
		`${label} : acceptez la demande d'autorisation administrateur de Windows…`,
	);
	try {
		runElevated(commands);
	} catch {
		console.error(
			"Opération annulée ou refusée par Windows (droits d'administrateur requis).",
		);
		process.exitCode = 1;
	}
}

if (!["open", "close", "status"].includes(action)) {
	console.error("Usage : node scripts/lan.mjs open | close | status");
	process.exitCode = 1;
} else if (action === "status") {
	printStatus();
} else if (!isWsl()) {
	console.log(
		`Hors WSL, aucune redirection n'est nécessaire : « npm run dev:lan » écoute sur toutes les interfaces. Autorisez le port TCP ${LAN_PORT} dans le pare-feu si besoin.`,
	);
} else if (action === "open") {
	const mode = wslNetworkingMode();
	const target = wslAddress();
	if (mode !== "mirrored" && !target) {
		console.error("Adresse WSL introuvable.");
		process.exitCode = 1;
	} else {
		elevate(openCommands(mode, target), "Ouverture sur le réseau local");
		printStatus();
	}
} else {
	elevate(closeCommands(), "Fermeture de l'accès réseau local");
	printStatus();
}
