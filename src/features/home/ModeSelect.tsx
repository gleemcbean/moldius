import {
	PRIVATE_CODE_LENGTH,
	PRIVATE_LOBBY_CAPACITY,
} from "@shared/config/index";
import { POSSESSED_MIN_PLAYERS } from "@shared/config/party";
import { dailyChallenge, formatDailyCountdown } from "@shared/dailyChallenge";
import { inviteCodeFromText } from "@shared/inviteLink";
import { useState } from "react";
import { openOverlay } from "../../app/appStore";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { useT } from "../../i18n";
import { useDailyClock } from "../daily/useDailyClock";
import {
	createDailyLobby,
	createPrivateLobby,
	joinPossessedLobby,
	joinPrivateLobby,
	quickJoin,
	startTutorial,
} from "../lobby/lobbyClient";
import classicArt from "./art/classic.png";
import dailyArt from "./art/daily.png";
import possessedArt from "./art/possessed.png";
import tutorialArt from "./art/tutorial.png";
import styles from "./ModeSelect.module.scss";
import type { GameMode } from "./modeArt";

const ART: Record<GameMode, string> = {
	classic: classicArt,
	daily: dailyArt,
	possessed: possessedArt,
	tutorial: tutorialArt,
};

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
	const { date, remainingMs } = useDailyClock();
	const challenge = dailyChallenge(date);
	const theme = t.daily.themes[challenge.theme];
	const [code, setCode] = useState("");
	const codeValid = code.length === PRIVATE_CODE_LENGTH;

	const start = (mode: GameMode) => {
		onClose();

		if (mode === "classic") {
			quickJoin(name);
		} else if (mode === "daily") {
			createDailyLobby(name);
		} else if (mode === "possessed") {
			joinPossessedLobby(name);
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
			mode: "possessed",
			title: t.party.possessed.modeName,
			text: t.party.possessed.modeText,
			meta: t.party.possessed.modeMeta(POSSESSED_MIN_PLAYERS),
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
							data-sound="confirm"
						>
							<span
								className={[
									styles.art,
									card.mode === "possessed" ? styles.possessedArt : "",
								].join(" ")}
							>
								<img src={ART[card.mode]} alt="" />
							</span>
							<span className={styles.title}>{card.title}</span>
							<span className={styles.text}>{card.text}</span>
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
			<form
				className={styles.private}
				onSubmit={(event) => {
					event.preventDefault();

					if (!ready) {
						return;
					}

					if (code.length === 0) {
						onClose();
						createPrivateLobby(name);
					} else if (codeValid) {
						onClose();
						joinPrivateLobby(name, code);
					}
				}}
			>
				<div className={styles.privateText}>
					<span className={styles.privateTitle}>{labels.private}</span>
					<span className={styles.privateHint}>
						{labels.privateText(PRIVATE_LOBBY_CAPACITY)}
					</span>
				</div>
				<input
					className={styles.codeInput}
					value={code}
					placeholder={t.home.codePlaceholder}
					maxLength={PRIVATE_CODE_LENGTH}
					onChange={(event) =>
						setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
					}
					onPaste={(event) => {
						const pasted = inviteCodeFromText(
							event.clipboardData.getData("text"),
							window.location.origin,
						);

						if (pasted) {
							event.preventDefault();
							setCode(pasted);
						}
					}}
					aria-label={t.home.codeLabel}
					spellCheck={false}
					autoComplete="off"
					data-selectable=""
				/>
				<Button
					variant="secondary"
					type="submit"
					icon={code.length === 0 ? <Icon name="lock" /> : undefined}
					disabled={!ready || (code.length > 0 && !codeValid)}
				>
					{code.length === 0 ? t.home.createPrivate : t.home.joinFriends}
				</Button>
			</form>
		</Modal>
	);
}
