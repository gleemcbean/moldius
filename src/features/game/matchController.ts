import { navigate, showToast } from "../../app/appStore";
import { currentMessages } from "../../i18n";
import { hudStore, initialHud } from "../hud/hudStore";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";
import { getSocket } from "../network/socket";
import { matchStore, resetMatchState } from "./matchStore";
import { GameSession } from "./session/GameSession";
import { LOAD_STEPS } from "./session/SessionLoader";

let session: GameSession | null = null;
let initialized = false;

export function currentSession(): GameSession | null {
	return session;
}

function disposeSession(): void {
	session?.dispose();
	session = null;
}

function updateStep(stepId: string, fraction: number): void {
	matchStore.set((state) => ({
		loadingSteps: state.loadingSteps.map((step) =>
			step.id === stepId
				? { ...step, progress: Math.max(step.progress, fraction) }
				: step,
		),
	}));
}

export function initMatchController(): void {
	if (initialized) {
		return;
	}
	initialized = true;
	const socket = getSocket();
	socket.on("game:init", (init) => {
		if (session && session.matchId === init.matchId) {
			return;
		}
		disposeSession();
		resetMatchState();
		hudStore.replace(initialHud());
		matchStore.set({
			init,
			loadingSteps: LOAD_STEPS.map((id) => ({ id, progress: 0 })),
		});
		navigate("loading");
		const playerId = sessionStore.get().playerId ?? "";
		const created = new GameSession(init, playerId);
		session = created;
		created
			.load(updateStep)
			.then(() => {
				if (session !== created) {
					return;
				}
				matchStore.set({ loaded: true });
				socket.emit("game:loaded", {
					matchId: init.matchId,
					layoutChecksum: init.layoutChecksum,
				});
				if (matchStore.get().begin) {
					navigate("game");
				}
			})
			.catch((error: unknown) => {
				const labels = currentMessages().game.loading;
				const message =
					error instanceof Error ? error.message : labels.genericError;
				matchStore.set({ error: message });
				showToast(labels.failed(message), "error", 8000);
			});
	});
	socket.on("game:begin", (begin) => {
		if (!session || begin.matchId !== session.matchId) {
			return;
		}
		session.begin(begin);
		matchStore.set({ begin });
		if (session.isLoaded) {
			navigate("game");
		}
	});
	socket.on("game:snapshot", (snapshot) => session?.handleSnapshot(snapshot));
	socket.on("game:events", ({ t, events }) => session?.handleEvents(events, t));
	socket.on("game:forcedMove", (move) => session?.handleForcedMove(move));
	socket.on("game:castResult", (result) => session?.handleCastResult(result));
	socket.on("game:inventory", (inventory) =>
		session?.handleInventory(inventory),
	);
	socket.on("game:end", (results) => {
		if (!session || results.matchId !== session.matchId) {
			return;
		}
		disposeSession();
		matchStore.set({ results });
		navigate("results");
	});
	socket.on("game:aborted", ({ reason }) => {
		disposeSession();
		resetMatchState();
		showToast(currentMessages().game.aborted[reason], "error");
		navigate(lobbyStore.get().lobby ? "lobby" : "home");
	});
}

export function leaveMatch(): void {
	getSocket().emit("game:leave");
	disposeSession();
	resetMatchState();
	lobbyStore.set({ lobby: null });
	navigate("home");
}

export function closeResults(target: "lobby" | "home"): void {
	resetMatchState();
	if (target === "home") {
		getSocket().emit("lobby:leave");
		lobbyStore.set({ lobby: null });
		navigate("home");
		return;
	}
	navigate(lobbyStore.get().lobby ? "lobby" : "home");
}
