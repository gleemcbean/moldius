/** Les gestes offerts par l'application de bureau (desktop/preload.cjs), absents du navigateur. */
export interface DesktopApp {
	isDesktop: true;
	quit(): void;
	minimize(): void;
	toggleFullscreen(): void;
	isFullscreen(): boolean;
	onFullscreenChange(listener: (fullscreen: boolean) => void): () => void;
}

export const desktopApp: DesktopApp | null =
	(window as Window & { moldiusDesktop?: DesktopApp }).moldiusDesktop ?? null;
