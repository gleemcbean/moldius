import { appStore, openOverlay } from "../../app/appStore";
import { desktopApp } from "../../app/desktopApp";
import { currentMessages } from "../../i18n";
import { isFullscreen } from "../../utils/fullscreen";
import { leaveLobby } from "../lobby/lobbyClient";
import { lobbyStore } from "../lobby/lobbyStore";
import { profileViewStore } from "../profile/profileViewStore";
import { leaveVoice } from "../voice/voiceController";
import {
	type MenuBuilder,
	type MenuSlot,
	showMenuAt,
} from "./contextMenuStore";
import { friendsAvailable, inviteSlots } from "./lobbyMenus";

const NATIVE_TARGETS =
	"input, textarea, select, [contenteditable='true'], a[href]";

function fullscreenActive(): boolean {
	return desktopApp ? desktopApp.isFullscreen() : isFullscreen();
}

function toggleFullscreen(): void {
	if (desktopApp) {
		desktopApp.toggleFullscreen();

		return;
	}

	if (isFullscreen()) {
		void document.exitFullscreen().catch(() => undefined);
	} else {
		void document.documentElement.requestFullscreen().catch(() => undefined);
	}
}

function fullscreenAvailable(): boolean {
	return Boolean(desktopApp) || document.fullscreenEnabled;
}

function lobbySlots(): MenuSlot[] {
	const lobby = lobbyStore.get().lobby;

	return lobby && appStore.get().screen === "lobby" ? inviteSlots(lobby) : [];
}

function leaveSlots(): MenuSlot[] {
	const labels = currentMessages().contextMenu;
	const inLobby = lobbyStore.get().lobby && appStore.get().screen === "lobby";

	return [
		inLobby && {
			kind: "action",
			id: "leave",
			label: labels.leaveLobby,
			confirm: labels.leaveLobbyConfirm,
			icon: "door",
			danger: true,
			run: () => {
				leaveVoice();
				leaveLobby();
			},
		},
	];
}

function appMenu(): MenuBuilder {
	return () => {
		const labels = currentMessages().contextMenu.app;
		const home = appStore.get().screen === "home";
		const inLobby = lobbySlots().length > 0;
		const social = friendsAvailable() && !inLobby;
		const fullscreen = fullscreenActive();

		return [
			[
				{
					kind: "action",
					id: "settings",
					label: labels.settings,
					icon: "gear",
					run: () => openOverlay("settings"),
				},
				social && {
					kind: "action",
					id: "friends",
					label: labels.friends,
					icon: "users",
					run: () => openOverlay("friends"),
				},
				{
					kind: "action",
					id: "bestiary",
					label: labels.bestiary,
					icon: "book",
					run: () => openOverlay("bestiary"),
				},
				home && {
					kind: "action",
					id: "challenges",
					label: labels.challenges,
					icon: "check",
					run: () => openOverlay("challenges"),
				},
				home &&
					social && {
						kind: "action",
						id: "account",
						label: labels.account,
						icon: "user",
						run: () => openOverlay("account"),
					},
			],
			lobbySlots(),
			[
				fullscreenAvailable() && {
					kind: "action",
					id: "fullscreen",
					label: fullscreen ? labels.exitFullscreen : labels.fullscreen,
					icon: "fullscreen",
					checked: fullscreen,
					run: toggleFullscreen,
				},
			],
			leaveSlots(),
		];
	};
}

function wantsNativeMenu(target: EventTarget | null): boolean {
	if (target instanceof Element && target.closest(NATIVE_TARGETS)) {
		return true;
	}

	const selection = window.getSelection();

	return Boolean(
		selection && !selection.isCollapsed && selection.toString().trim(),
	);
}

function appMenuAllowed(): boolean {
	const { screen, overlay } = appStore.get();

	return (
		document.pointerLockElement === null &&
		screen !== "game" &&
		screen !== "loading" &&
		overlay === null &&
		profileViewStore.get().profileId === null
	);
}

export function installContextMenus(): () => void {
	const onContextMenu = (event: MouseEvent) => {
		if (event.defaultPrevented || wantsNativeMenu(event.target)) {
			return;
		}

		event.preventDefault();

		if (!appMenuAllowed()) {
			return;
		}

		const fromKeyboard = event.clientX === 0 && event.clientY === 0;
		const x = fromKeyboard ? window.innerWidth / 2 : event.clientX;
		const y = fromKeyboard ? window.innerHeight / 3 : event.clientY;

		showMenuAt(x, y, appMenu());
	};

	window.addEventListener("contextmenu", onContextMenu);

	return () => window.removeEventListener("contextmenu", onContextMenu);
}
