import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

export const LAN_PORT = 5173;
export const FIREWALL_RULE = `MYCELIUM LAN ${LAN_PORT}`;
const WSL_VM_CREATOR = "{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}";

export function isWsl() {
	if (process.platform !== "linux") {
		return false;
	}
	if (process.env.WSL_DISTRO_NAME) {
		return true;
	}
	try {
		return /microsoft/i.test(readFileSync("/proc/version", "utf8"));
	} catch {
		return false;
	}
}

export function wslNetworkingMode() {
	try {
		return (
			execFileSync("wslinfo", ["--networking-mode"], {
				encoding: "utf8",
			}).trim() || "nat"
		);
	} catch {
		return "nat";
	}
}

function ipv4(entries) {
	return entries
		.filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
		.map((entry) => entry.address)
		.filter((address) => !address.startsWith("169.254."));
}

export function wslAddress() {
	const interfaces = networkInterfaces();
	return ipv4(interfaces.eth0 ?? Object.values(interfaces).flat())[0] ?? null;
}

export function localAddresses() {
	return ipv4(Object.values(networkInterfaces()).flat());
}

export function powershell(command) {
	return execFileSync(
		"powershell.exe",
		["-NoProfile", "-NonInteractive", "-Command", command],
		{
			encoding: "utf8",
			cwd: existsSync("/mnt/c") ? "/mnt/c" : undefined,
			stdio: ["ignore", "pipe", "pipe"],
		},
	).replace(/\r/g, "");
}

export function windowsLanAddresses() {
	try {
		return powershell(
			"Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike 'vEthernet*' -and $_.InterfaceAlias -notlike 'Loopback*' -and $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { $_.IPAddress }",
		)
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => /^\d+\.\d+\.\d+\.\d+$/.test(line));
	} catch {
		return [];
	}
}

export function portProxyTarget(port = LAN_PORT) {
	try {
		const output = powershell("netsh interface portproxy show v4tov4");
		for (const line of output.split("\n")) {
			const [listenAddress, listenPort, connectAddress, connectPort] = line
				.trim()
				.split(/\s+/);
			if (
				listenAddress === "0.0.0.0" &&
				Number(listenPort) === port &&
				connectAddress
			) {
				return { address: connectAddress, port: Number(connectPort) };
			}
		}
	} catch {
		return null;
	}
	return null;
}

export function firewallRuleExists() {
	try {
		return (
			powershell(
				`if (Get-NetFirewallRule -DisplayName '${FIREWALL_RULE}' -ErrorAction SilentlyContinue) { 'oui' }`,
			).trim() === "oui"
		);
	} catch {
		return false;
	}
}

export function openCommands(mode, target) {
	const firewall = [
		`Remove-NetFirewallRule -DisplayName '${FIREWALL_RULE}' -ErrorAction SilentlyContinue`,
		`New-NetFirewallRule -DisplayName '${FIREWALL_RULE}' -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${LAN_PORT} -RemoteAddress LocalSubnet -Profile Any | Out-Null`,
	];
	if (mode === "mirrored") {
		return [
			...firewall,
			`Remove-NetFirewallHyperVRule -DisplayName '${FIREWALL_RULE}' -ErrorAction SilentlyContinue`,
			`New-NetFirewallHyperVRule -Name 'MYCELIUM-LAN-${LAN_PORT}' -DisplayName '${FIREWALL_RULE}' -Direction Inbound -VMCreatorId '${WSL_VM_CREATOR}' -Protocol TCP -LocalPorts ${LAN_PORT} -Action Allow | Out-Null`,
		];
	}
	return [
		`netsh interface portproxy delete v4tov4 listenport=${LAN_PORT} listenaddress=0.0.0.0 | Out-Null`,
		`netsh interface portproxy add v4tov4 listenport=${LAN_PORT} listenaddress=0.0.0.0 connectport=${LAN_PORT} connectaddress=${target}`,
		...firewall,
	];
}

export function closeCommands() {
	return [
		`netsh interface portproxy delete v4tov4 listenport=${LAN_PORT} listenaddress=0.0.0.0 | Out-Null`,
		`Remove-NetFirewallRule -DisplayName '${FIREWALL_RULE}' -ErrorAction SilentlyContinue`,
		`Remove-NetFirewallHyperVRule -DisplayName '${FIREWALL_RULE}' -ErrorAction SilentlyContinue`,
	];
}

export function runElevated(commands) {
	const script = ['$ErrorActionPreference = "Continue"', ...commands].join(
		"\n",
	);
	const encoded = Buffer.from(script, "utf16le").toString("base64");
	powershell(
		`Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}'`,
	);
}

export function lanReport() {
	const lines = [];
	if (!isWsl()) {
		const addresses = localAddresses();
		lines.push(`Sur ce PC : https://localhost:${LAN_PORT}`);
		for (const address of addresses) {
			lines.push(`Sur le réseau local : https://${address}:${LAN_PORT}`);
		}
		lines.push(
			`Autorisez le port TCP ${LAN_PORT} dans le pare-feu si les autres appareils n'y accèdent pas.`,
		);
		return lines;
	}
	const mode = wslNetworkingMode();
	const addresses = windowsLanAddresses();
	lines.push(`Sur ce PC : https://localhost:${LAN_PORT}`);
	for (const address of addresses) {
		lines.push(`Sur le réseau local : https://${address}:${LAN_PORT}`);
	}
	if (addresses.length === 0) {
		lines.push(
			"Adresse du PC sur le réseau local introuvable (Windows injoignable depuis WSL).",
		);
	}
	if (mode !== "mirrored") {
		const target = portProxyTarget();
		const wsl = wslAddress();
		if (!target || target.address !== wsl || !firewallRuleExists()) {
			lines.push(
				`Redirection Windows → WSL absente ou périmée (WSL : ${wsl ?? "inconnue"}) : exécutez « npm run lan:open » pour l'activer.`,
			);
		}
	} else if (!firewallRuleExists()) {
		lines.push(
			"Règle de pare-feu absente : exécutez « npm run lan:open » pour l'ajouter.",
		);
	}
	return lines;
}
