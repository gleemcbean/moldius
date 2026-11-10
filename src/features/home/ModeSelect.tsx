import { dailyChallenge, formatDailyCountdown } from "@shared/dailyChallenge";
import { DEFAULT_LANTERN_TINT, LANTERN_TINT_COLORS } from "@shared/rewards";
import { useEffect, useState } from "react";
import { openOverlay } from "../../app/appStore";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { useDailyClock } from "../daily/useDailyClock";
import {
	createDailyLobby,
	quickJoin,
	startTutorial,
} from "../lobby/lobbyClient";
import { settingsStore } from "../settings/settingsStore";
import { type GameMode, loadModeArt } from "./modeArt";
import { PublicLobbyPreview } from "./PublicLobbyPreview";
import styles from "./ModeSelect.module.scss";

/** Le choix du mode de jeu, après « Jouer » : partie classique, mode du jour ou tutoriel. */
export function ModeSelect({
	name,
	ready,
	onClose,
}: {
	name: string;
	ready: boolean;
	onClose: () => void;
}) {
	const t = useT();
	const labels = t.home.modes;
	const color = useStore(settingsStore, (state) => state.playerColor);
	const pattern = useStore(settingsStore, (state) => state.playerPattern);
	const lantern = useStore(settingsStore, (state) => state.playerLantern);
	const { date, remainingMs } = useDailyClock();
	const challenge = dailyChallenge(date);
	const theme = t.daily.themes[challenge.theme];
	const [art, setArt] = useState<Record<GameMode, string> | null>(null);

	useEffect(() => {
		let alive = true;
		loadModeArt({
			color,
			pattern,
			lantern:
				lantern === DEFAULT_LANTERN_TINT ? null : LANTERN_TINT_COLORS[lantern],
		})
			.then((drawn) => alive && setArt(drawn))
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [color, pattern, lantern]);

	const start = (mode: GameMode) => {
		onClose();
		if (mode === "classic") {
			quickJoin(name);
		} else if (mode === "daily") {
			createDailyLobby(name);
		} else {
			startTutorial(name);
		}
	};

	const cards: {
		mode: GameMode;
		title: string;
		text: string;
		meta: string;
	}[] = [
		{
			mode: "classic",
			title: labels.classic,
			text: labels.classicText,
			meta: t.home.quickJoin,
		},
		{
			mode: "daily",
			title: labels.daily,
			text: labels.dailyText(
				theme.name,
				labels.dailyFacts(
					t.world.manorSizes[challenge.config.manorSize],
					t.daily.anomalies(challenge.config.simultaneousAnomalies),
					t.lobby.rules.minutes(challenge.config.durationMinutes),
				),
			),
			meta: t.daily.nextIn(formatDailyCountdown(remainingMs)),
		},
		{
			mode: "tutorial",
			title: labels.tutorial,
			text: labels.tutorialText,
			meta: t.home.tutorialHint,
		},
	];

	return (
		<Modal title={labels.title} onClose={onClose} wide>
			<div className={styles.cards}>
				{cards.map((card) => (
					<article key={card.mode} className={styles.card}>
						<button
							type="button"
							className={styles.choose}
							disabled={!ready}
							onClick={() => start(card.mode)}
							data-selectable=""
						>
							<span className={styles.art}>
								{art ? (
									<img src={art[card.mode]} alt="" />
								) : (
									<span className={styles.sketching}>{t.bestiary.drawing}</span>
								)}
							</span>
							<span className={styles.title}>{card.title}</span>
							<span className={styles.text}>{card.text}</span>
							{card.mode === "classic" ? (
								<PublicLobbyPreview className={styles.lobby} />
							) : null}
							<span className={styles.meta}>{card.meta}</span>
						</button>
						{card.mode === "daily" ? (
							<button
								type="button"
								className={styles.extra}
								onClick={() => {
									onClose();
									openOverlay("daily");
								}}
								data-selectable=""
							>
								<Icon name="crown" />
								{labels.leaderboard}
							</button>
						) : null}
					</article>
				))}
			</div>
		</Modal>
	);
}
