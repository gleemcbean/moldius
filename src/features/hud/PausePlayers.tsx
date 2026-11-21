import { Icon } from "../../components/Icon";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { openContextMenu } from "../contextMenu/contextMenuStore";
import { MenuButton } from "../contextMenu/MenuButton";
import { playerMenu } from "../contextMenu/playerMenu";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";
import { voicePrefsStore } from "../voice/voicePrefs";
import styles from "./HudParts.module.scss";

export function PausePlayers() {
	const t = useT();
	const lobby = useStore(lobbyStore, (state) => state.lobby);
	const selfId = useStore(sessionStore, (state) => state.playerId);
	const muted = useStore(voicePrefsStore, (state) => state.muted);

	const others =
		lobby?.players.filter(
			(player) => player.id !== selfId && player.connected,
		) ?? [];

	if (!lobby || others.length === 0) {
		return null;
	}

	return (
		<section className={styles.pausePlayers}>
			<h3>{t.contextMenu.pause.players}</h3>
			<ul>
				{others.map((player) => {
					const menu = playerMenu(
						{
							playerId: player.id,
							name: player.name,
							profileId: player.profileId,
							color: player.color,
						},
						"match",
					);

					return (
						<li
							key={player.id}
							onContextMenu={(event) => openContextMenu(event, menu)}
							data-selector-row=""
							data-context-menu=""
						>
							<i
								className={styles.pauseSwatch}
								style={{ background: hexColor(player.color) }}
								aria-hidden="true"
							/>
							<span className={styles.pauseName} title={player.name}>
								{player.name}
							</span>
							{lobby.hostId === player.id ? (
								<Icon name="crown" className={styles.pauseHost} />
							) : null}
							{muted[player.id] ? (
								<Icon name="speakerOff" className={styles.pauseMuted} />
							) : null}
							<MenuButton
								build={menu}
								label={t.contextMenu.more(player.name)}
							/>
						</li>
					);
				})}
			</ul>
			<p className={styles.pauseHint}>{t.contextMenu.pause.hint}</p>
		</section>
	);
}
