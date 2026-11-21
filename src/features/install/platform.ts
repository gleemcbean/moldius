export type DownloadPlatform =
	| "win"
	| "steamdeck"
	| "linux"
	| "debian"
	| "redhat";

export const downloadUrl = (platform: DownloadPlatform): string =>
	`/download/${platform}`;

function platformHint(): string {
	const data = (
		navigator as Navigator & { userAgentData?: { platform?: string } }
	).userAgentData;

	return `${data?.platform ?? ""} ${navigator.platform} ${navigator.userAgent}`;
}

interface DeckProbe {
	screen?: { width: number; height: number };
	navigator?: { maxTouchPoints?: number };
}

function deckScreen(): boolean {
	const { screen, navigator: probe } = globalThis as DeckProbe;

	if (!screen) {
		return false;
	}

	const short = Math.min(screen.width, screen.height);
	const long = Math.max(screen.width, screen.height);

	return short === 800 && long === 1280 && (probe?.maxTouchPoints ?? 0) > 0;
}

export function detectDownloadPlatform(
	hint: string = platformHint(),
	deck: boolean = deckScreen(),
): DownloadPlatform | null {
	if (/Android|CrOS|iPhone|iPad|iPod/i.test(hint)) {
		return null;
	}

	if (/Windows|Win32|Win64/i.test(hint)) {
		return "win";
	}

	if (!/Linux|X11/i.test(hint)) {
		return null;
	}

	if (deck || /SteamOS|Steam ?Deck|Valve Steam/i.test(hint)) {
		return "steamdeck";
	}

	if (/Ubuntu|Debian|Mint|Pop!_OS|elementary/i.test(hint)) {
		return "debian";
	}

	if (/Fedora|Red Hat|CentOS|Rocky|AlmaLinux|openSUSE|SUSE/i.test(hint)) {
		return "redhat";
	}

	return "linux";
}
