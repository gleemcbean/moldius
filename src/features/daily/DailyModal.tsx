import { dailyChallenge, formatDailyCountdown } from "@shared/dailyChallenge";
import type { DailyBoard, DailyScoreEntry } from "@shared/protocol/account";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { TaglineBadge } from "../../components/TaglineBadge";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { accountApi } from "../account/accountApi";
import { accountStore } from "../account/accountStore";
import { createDailyLobby } from "../lobby/lobbyClient";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";
import { ProfileLink } from "../profile/ProfileLink";
import { settingsStore } from "../settings/settingsStore";
import styles from "./DailyModal.module.scss";
import { useDailyClock } from "./useDailyClock";

function ScoreRow({ entry }: { entry: DailyScoreEntry }) {
	const t = useT();
	return (
		<li className={entry.self ? styles.self : ""} data-selector-row="">
			<span className={styles.rank}>{entry.rank}</span>
			<span className={styles.hat}>
				<HatPreview color={entry.color} pattern={entry.pattern} />
			</span>
			<ProfileLink
				profileId={entry.profileId}
				name={entry.name}
				className={styles.name}
			>
				{entry.name}
				<TaglineBadge tagline={entry.tagline} />
			</ProfileLink>
			<span className={styles.stat}>
				{t.game.results.captures(entry.captures)}
			</span>
			<strong>{t.common.points(entry.score)}</strong>
		</li>
	);
}

export function DailyModal({ onClose }: { onClose: () => void }) {
	const t = useT();
	const labels = t.daily;
	const { date, remainingMs } = useDailyClock();
	const challenge = useMemo(() => dailyChallenge(date), [date]);
	const [board, setBoard] = useState<DailyBoard | null>(null);
	const [failed, setFailed] = useState(false);
	const status = useStore(accountStore, (state) => state.status);
	const name = useStore(settingsStore, (state) => state.playerName).trim();
	const connection = useStore(sessionStore, (state) => state.status);
	const pending = useStore(lobbyStore, (state) => state.pending);
	const screenLobby = useStore(lobbyStore, (state) => state.lobby);
	useEffect(() => {
		let cancelled = false;
		void accountApi.daily(challenge.date).then((result) => {
			if (cancelled) {
				return;
			}
			if (result.ok) {
				setBoard(result.value);
			} else {
				setFailed(true);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [challenge.date]);
	const { config } = challenge;
	const facts = [
		t.world.manorSizes[config.manorSize],
		labels.anomalies(config.simultaneousAnomalies),
		t.lobby.rules.minutes(config.durationMinutes),
	];
	const canPlay =
		connection === "connected" && name.length >= 2 && !pending && !screenLobby;
	return (
		<Modal title={labels.title} onClose={onClose}>
			<section className={styles.theme}>
				<p className={styles.countdown}>
					{labels.nextIn(formatDailyCountdown(remainingMs))}
				</p>
				<h3>{labels.themes[challenge.theme].name}</h3>
				<p>{labels.themes[challenge.theme].description}</p>
				<ul className={styles.facts}>
					{facts.map((fact) => (
						<li key={fact}>{fact}</li>
					))}
				</ul>
			</section>
			<section className={styles.board}>
				<h3>{labels.leaderboard}</h3>
				{board && board.entries.length > 0 ? (
					<ol>
						{board.entries.map((entry) => (
							<ScoreRow key={`${entry.rank}-${entry.name}`} entry={entry} />
						))}
						{board.me && !board.entries.some((entry) => entry.self) ? (
							<ScoreRow entry={board.me} />
						) : null}
					</ol>
				) : (
					<p className={styles.empty}>
						{failed
							? labels.unavailable
							: board
								? labels.empty
								: labels.loading}
					</p>
				)}
				{status === "signed-in" ? null : (
					<p className={styles.note}>{labels.signInHint}</p>
				)}
			</section>
			<div className={styles.actions}>
				<Button
					size="large"
					icon={<Icon name="play" />}
					disabled={!canPlay}
					onClick={() => {
						createDailyLobby(name);
						onClose();
					}}
				>
					{labels.play}
				</Button>
			</div>
		</Modal>
	);
}
