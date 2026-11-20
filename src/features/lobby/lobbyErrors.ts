import type { LobbyError } from "@shared/protocol/lobby";
import { currentMessages } from "../../i18n";

export function lobbyErrorText(error: LobbyError): string {
	const labels = currentMessages().lobby;

	if (error.code === "not-enough-players" && error.minPlayers !== undefined) {
		return labels.notEnoughPlayers(error.minPlayers);
	}

	return labels.errors[error.code] ?? error.message;
}
