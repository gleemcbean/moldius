import {
	PLAYER_NAME_MAX_LENGTH,
	PRIVATE_CODE_LENGTH,
	PRIVATE_LOBBY_CAPACITY,
} from "@shared/config/index";
import { dailyChallenge, formatDailyCountdown } from "@shared/dailyChallenge";
import { DEFAULT_HAT_PATTERN } from "@shared/hatPatterns";
import { inviteCodeFromText } from "@shared/inviteLink";
import {
	accountProgress,
	DEFAULT_LANTERN_TINT,
	hatUnlocked,
	lanternUnlocked,
} from "@shared/rewards";
import { useEffect, useMemo, useState } from "react";
import { openOverlay } from "../../app/appStore";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { SelectorGroup } from "../../components/SelectorGroup";
import { useStore } from "../../hooks/useStore";
import { useLanguage, useT } from "../../i18n";
import type { Language } from "../../i18n/language";
import { defaultNames } from "../../i18n/names";
import { accountStore } from "../account/accountStore";
import { useDailyClock } from "../daily/useDailyClock";
import { friendsStore } from "../friends/friendsStore";
import { installStore, promptInstall } from "../install/installStore";
import { consumeInvite, inviteStore } from "../lobby/inviteStore";
import {
	createPrivateLobby,
	joinPrivateLobby,
	quickJoin,
	startTutorial,
} from "../lobby/lobbyClient";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";
import { settingsStore, updateSettings } from "../settings/settingsStore";
import { AppearancePicker } from "./AppearancePicker";
import { HomeBackdrop } from "./HomeBackdrop";
import styles from "./HomeScreen.module.scss";
import { PublicLobbyPreview } from "./PublicLobbyPreview";

function pickSuggestions(language: Language, current: string): string[] {
	const pool = defaultNames(language).filter((name) => name !== current);
	const shuffled = [...pool].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, 3);
}

function DailyButton() {
	const t = useT();
	const { date, remainingMs } = useDailyClock();
	const { theme } = dailyChallenge(date);
	return (
		<div className={[styles.hintAnchor, styles.dailyRow].join(" ")}>
			<Button
				variant="secondary"
				wide
				icon={<Icon name="crown" />}
				onClick={() => openOverlay("daily")}
			>
				{t.home.daily(t.daily.themes[theme].name)}
			</Button>
			<span
				className={styles.dailyCountdown}
				title={t.daily.nextIn(formatDailyCountdown(remainingMs))}
			>
				{formatDailyCountdown(remainingMs)}
			</span>
			<span role="tooltip" className={styles.sideHint}>
				{t.home.dailyHint}
			</span>
		</div>
	);
}

export function HomeScreen() {
	const t = useT();
	const friendAlerts = useStore(
		friendsStore,
		(state) => state.overview?.incoming.length ?? 0,
	);
	const language = useLanguage();
	const name = useStore(settingsStore, (state) => state.playerName);
	const pattern = useStore(settingsStore, (state) => state.playerPattern);
	const lantern = useStore(settingsStore, (state) => state.playerLantern);
	const connection = useStore(sessionStore, (state) => state.status);
	const pending = useStore(lobbyStore, (state) => state.pending);
	const accountStatus = useStore(accountStore, (state) => state.status);
	const account = useStore(accountStore, (state) => state.account);
	const installable = useStore(installStore, (state) => state.available);
	const [code, setCode] = useState("");
	const [suggestionSeed, setSuggestionSeed] = useState(0);
	const suggestions = useMemo(
		() => pickSuggestions(language, name),
		[suggestionSeed, language],
	);
	const trimmed = name.trim();
	const nameValid = trimmed.length >= 2;
	const ready = connection === "connected" && nameValid && !pending;
	const codeValid = code.length === PRIVATE_CODE_LENGTH;
	const invite = useStore(inviteStore, (state) => state.code);
	const stats = useMemo(
		() => (account ? accountProgress(account) : null),
		[account],
	);

	useEffect(() => {
		if (accountStatus === "loading") {
			return;
		}
		if (!hatUnlocked(pattern, stats)) {
			updateSettings({ playerPattern: DEFAULT_HAT_PATTERN });
		}
		if (!lanternUnlocked(lantern, stats)) {
			updateSettings({ playerLantern: DEFAULT_LANTERN_TINT });
		}
	}, [accountStatus, pattern, lantern, stats]);

	useEffect(() => {
		if (invite) {
			setCode(invite);
		}
	}, [invite]);

	useEffect(() => {
		if (invite && ready) {
			consumeInvite();
			joinPrivateLobby(trimmed, invite);
		}
	}, [invite, ready, trimmed]);

	return (
		<main className={styles.home}>
			<HomeBackdrop />
			<div className={styles.shade} />
			<SelectorGroup className={styles.panel}>
				<header className={styles.brand}>
					<h1 className={styles.title}>MOLDIUS</h1>
				</header>

				<section className={styles.nameBlock}>
					<label className={styles.label} htmlFor="player-name">
						{t.home.yourMushroom}
					</label>
					<input
						id="player-name"
						className={styles.nameInput}
						value={name}
						maxLength={PLAYER_NAME_MAX_LENGTH}
						onChange={(event) =>
							updateSettings({ playerName: event.target.value })
						}
						spellCheck={false}
						autoComplete="off"
						data-selectable=""
					/>
					<div className={styles.suggestions}>
						{suggestions.map((suggestion) => (
							<button
								key={suggestion}
								type="button"
								title={suggestion}
								className={styles.chip}
								onClick={() => updateSettings({ playerName: suggestion })}
								data-selectable=""
							>
								{suggestion}
							</button>
						))}
						<button
							type="button"
							className={styles.chip}
							onClick={() => setSuggestionSeed((value) => value + 1)}
							aria-label={t.home.otherNames}
							data-selectable=""
						>
							↻
						</button>
					</div>
					<AppearancePicker stats={stats} />
				</section>

				<div className={styles.actions}>
					<div className={styles.hintAnchor}>
						<Button
							size="large"
							wide
							icon={<Icon name="play" />}
							disabled={!ready}
							aria-describedby="public-lobby-hint"
							onClick={() => quickJoin(trimmed)}
						>
							{t.home.quickJoin}
						</Button>
						<PublicLobbyPreview />
					</div>
					<div className={styles.hintAnchor}>
						<Button
							variant="secondary"
							wide
							icon={<Icon name="lock" />}
							disabled={!ready}
							aria-describedby="private-lobby-hint"
							onClick={() => createPrivateLobby(trimmed)}
						>
							{t.home.createPrivate}
						</Button>
						<span
							id="private-lobby-hint"
							role="tooltip"
							className={styles.sideHint}
						>
							{t.home.createPrivateHint(PRIVATE_LOBBY_CAPACITY)}
						</span>
					</div>
					<DailyButton />
					<form
						className={styles.codeRow}
						onSubmit={(event) => {
							event.preventDefault();
							if (ready && codeValid) {
								joinPrivateLobby(trimmed, code);
							}
						}}
					>
						<input
							className={styles.codeInput}
							value={code}
							placeholder={t.home.codePlaceholder}
							maxLength={PRIVATE_CODE_LENGTH}
							onChange={(event) =>
								setCode(
									event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
								)
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
							disabled={!ready || !codeValid}
						>
							{t.home.joinFriends}
						</Button>
					</form>
					<div className={styles.hintAnchor}>
						<Button
							variant="secondary"
							wide
							disabled={!ready}
							aria-describedby="tutorial-hint"
							onClick={() => startTutorial(trimmed)}
						>
							{t.home.tutorial}
						</Button>
						<span id="tutorial-hint" role="tooltip" className={styles.sideHint}>
							{t.home.tutorialHint}
						</span>
					</div>
				</div>

				<div className={styles.more}>
					<button
						type="button"
						className={styles.tile}
						onClick={() => openOverlay("bestiary")}
						data-selectable=""
					>
						<span className={styles.tileIcon}>
							<Icon name="book" />
						</span>
					</button>
					<button
						type="button"
						className={styles.tile}
						onClick={() => openOverlay("challenges")}
						title={t.challenges.button}
						aria-label={t.challenges.button}
						data-selectable=""
					>
						<span className={styles.tileIcon}>
							<Icon name="check" />
						</span>
					</button>
					{accountStatus === "loading" ||
					accountStatus === "disabled" ? null : (
						<button
							type="button"
							className={styles.tile}
							onClick={() => openOverlay("account")}
							title={account?.displayName}
							data-selectable=""
						>
							<span className={styles.tileIcon}>
								<Icon name="user" />
							</span>
						</button>
					)}
					{accountStatus === "loading" ||
					accountStatus === "disabled" ? null : (
						<button
							type="button"
							className={styles.tile}
							onClick={() => openOverlay("friends")}
							title={t.home.friends}
							aria-label={t.home.friends}
							data-selectable=""
						>
							<span className={styles.tileIcon}>
								<Icon name="users" />
							</span>
							{friendAlerts > 0 ? (
								<span className={styles.tileBadge}>{friendAlerts}</span>
							) : null}
						</button>
					)}
					<button
						type="button"
						className={styles.tile}
						onClick={() => openOverlay("settings")}
						data-selectable=""
					>
						<span className={styles.tileIcon}>
							<Icon name="gear" />
						</span>
					</button>
					{installable ? (
						<button
							type="button"
							className={styles.tile}
							onClick={() => void promptInstall()}
							data-selectable=""
						>
							<span className={styles.tileIcon}>
								<Icon name="download" />
							</span>
						</button>
					) : null}
				</div>

				{connection === "connected" ? null : (
					<p className={styles.offline} role="status">
						{connection === "connecting" ? t.home.connecting : t.home.offline}
					</p>
				)}
			</SelectorGroup>
			<nav className={styles.legal} aria-label={t.home.legal}>
				<a href={`/terms?lang=${language}`}>{t.home.terms}</a>
				<a href={`/privacy?lang=${language}`}>{t.home.privacy}</a>
			</nav>
		</main>
	);
}
