export interface DesktopApp {
	isDesktop: true;
	quit(): void;
	minimize(): void;
	toggleFullscreen(): void;
	isFullscreen(): boolean;
	onFullscreenChange(listener: (fullscreen: boolean) => void): () => void;
	discord?: DesktopDiscord;
}

export type DiscordStatus =
	| "unavailable"
	| "signed-out"
	| "authorizing"
	| "connecting"
	| "ready"
	| "error";

export interface DiscordUser {
	id: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	status: "online" | "idle" | "dnd" | "offline";
	playing: boolean;
	provisional: boolean;
}

export interface DiscordBridgeState {
	available: boolean;
	status: DiscordStatus;
	error: string | null;
	user: DiscordUser | null;
	friends: DiscordUser[];
}

export interface DiscordActivity {
	state?: string;
	details?: string;
	startedAt?: number;
	largeImage?: string;
	largeText?: string;
	party?: { id: string; size: number; max: number; public: boolean };
	joinSecret?: string;
}

export interface DiscordAccountReply {
	ok: boolean;
	outcome?: string | null;
	proof?: string | null;
	discord?: string | null;
	error?: string | null;
}

export interface DesktopDiscord {
	getState(): Promise<DiscordBridgeState | null>;
	onState(listener: (state: DiscordBridgeState) => void): () => void;
	account(
		intent: "login" | "link" | "proof",
		language: string,
	): Promise<DiscordAccountReply>;
	disconnect(): void;
	setPresence(activity: DiscordActivity | null): void;
	invite(
		userId: string,
		message: string,
	): Promise<{ ok: boolean; error: string | null }>;
	onJoin(listener: (secret: string) => void): () => void;
}

export const desktopApp: DesktopApp | null =
	(window as Window & { moldiusDesktop?: DesktopApp }).moldiusDesktop ?? null;
