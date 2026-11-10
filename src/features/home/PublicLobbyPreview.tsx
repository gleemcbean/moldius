import type { PublicLobbyPreview as Preview } from "@shared/protocol/friends";
import { useEffect, useState } from "react";
import { HatPreview } from "../../components/HatPreview";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { sessionStore } from "../network/sessionStore";
import { getSocket } from "../network/socket";
import styles from "./HomeScreen.module.scss";

const REFRESH_MS = 4000;

/** Qui attend dans le lobby public, sur la carte « Partie classique » du choix de mode. */
export function PublicLobbyPreview({ className }: { className: string }) {
	const t = useT();
	const connected = useStore(
		sessionStore,
		(state) => state.status === "connected",
	);
	const [preview, setPreview] = useState<Preview | null>(null);

	useEffect(() => {
		if (!connected) {
			setPreview(null);
			return;
		}
		let active = true;
		const load = () => {
			if (document.hidden) {
				return;
			}
			getSocket().emit("lobby:peekPublic", (reply) => {
				if (active && reply.ok) {
					setPreview(reply.value);
				}
			});
		};
		load();
		const timer = window.setInterval(load, REFRESH_MS);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [connected]);

	if (!preview) {
		return null;
	}
	return (
		<div className={className}>
			<span className={styles.publicCount}>
				{t.home.publicCount(preview.players.length, preview.capacity)}
			</span>
			{preview.players.length > 0 ? (
				<ul className={styles.publicPlayers}>
					{preview.players.map((player) => (
						<li
							key={`${player.name}-${player.color}-${player.pattern}`}
							title={player.name}
						>
							<HatPreview color={player.color} pattern={player.pattern} />
							<span>{player.name}</span>
						</li>
					))}
				</ul>
			) : (
				<span className={styles.publicEmpty}>{t.home.publicEmpty}</span>
			)}
			{preview.playing > 0 ? (
				<span className={styles.publicEmpty}>
					{t.home.publicPlaying(preview.playing)}
				</span>
			) : null}
		</div>
	);
}
