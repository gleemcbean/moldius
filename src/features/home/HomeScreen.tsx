import {
	PLAYER_NAME_MAX_LENGTH,
	PRIVATE_CODE_LENGTH,
	PRIVATE_LOBBY_CAPACITY,
} from "@shared/config/index";
import { DEFAULT_HAT_PATTERN } from "@shared/hatPatterns";
import { inviteCodeFromText } from "@shared/inviteLink";
import {
	accountProgress,
	DEFAULT_LANTERN_TINT,
	hatUnlocked,
	lanternUnlocked,
	taglineUnlocked,
} from "@shared/rewards";
import { useEffect, useMemo, useState } from "react";
import { openOverlay } from "../../app/appStore";
import { desktopApp } from "../../app/desktopApp";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { SelectorGroup } from "../../components/SelectorGroup";
import { useStore } from "../../hooks/useStore";
import { useLanguage, useT } from "../../i18n";
import { accountStore } from "../account/accountStore";
import { friendsStore } from "../friends/friendsStore";
import { installStore, promptInstall } from "../install/installStore";
import { consumeInvite, inviteStore } from "../lobby/inviteStore";
import { createPrivateLobby, joinPrivateLobby } from "../lobby/lobbyClient";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";
import { settingsStore, updateSettings } from "../settings/settingsStore";
import { AppearancePicker } from "./AppearancePicker";
import { HomeBackdrop } from "./HomeBackdrop";
import { ModeSelect } from "./ModeSelect";
import styles from "./HomeScreen.module.scss";

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
	const tagline = useStore(settingsStore, (state) => state.playerTagline);
	const connection = useStore(sessionStore, (state) => state.status);
	const pending = useStore(lobbyStore, (state) => state.pending);
	const accountStatus = useStore(accountStore, (state) => state.status);
	const account = useStore(accountStore, (state) => state.account);
	const installable = useStore(installStore, (state) => state.available);
	const [code, setCode] = useState("");
	const [choosingMode, setChoosingMode] = useState(false);
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
		if (!taglineUnlocked(tagline, stats)) {
			updateSettings({ playerTagline: null });
		}
	}, [accountStatus, pattern, lantern, tagline, stats]);

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
					<AppearancePicker stats={stats} />
				</section>

				<div className={styles.actions}>
					<Button
						size="large"
						wide
						icon={<Icon name="play" />}
						disabled={!ready}
						onClick={() => setChoosingMode(true)}
					>
						{t.home.play}
					</Button>
					<form
						className={styles.codeRow}
						onSubmit={(event) => {
							event.preventDefault();
							if (!ready) {
								return;
							}
							if (code.length === 0) {
								createPrivateLobby(trimmed);
							} else if (codeValid) {
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
							icon={code.length === 0 ? <Icon name="lock" /> : undefined}
							title={
								code.length === 0
									? t.home.createPrivateHint(PRIVATE_LOBBY_CAPACITY)
									: undefined
							}
							disabled={!ready || (code.length > 0 && !codeValid)}
						>
							{code.length === 0 ? t.home.createPrivate : t.home.joinFriends}
						</Button>
					</form>
					{desktopApp ? (
						<Button
							variant="ghost"
							wide
							icon={<Icon name="door" />}
							onClick={() => desktopApp?.quit()}
						>
							{t.home.quitGame}
						</Button>
					) : null}
				</div>

				<div className={styles.more}>
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
						<span className={styles.tileTitle}>
							<span>{t.challenges.button}</span>
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
							<span className={styles.tileTitle}>
								<span>{account ? t.home.myAccount : t.home.signIn}</span>
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
							<span className={styles.tileTitle}>
								<span>{t.home.friends}</span>
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
						title={t.home.settings}
						aria-label={t.home.settings}
						data-selectable=""
					>
						<span className={styles.tileIcon}>
							<Icon name="gear" />
						</span>
						<span className={styles.tileTitle}>
							<span>{t.home.settings}</span>
						</span>
					</button>
					{installable ? (
						<button
							type="button"
							className={styles.tile}
							onClick={promptInstall}
							title={t.home.install}
							aria-label={t.home.install}
							data-selectable=""
						>
							<span className={styles.tileIcon}>
								<Icon name="download" />
							</span>
							<span className={styles.tileTitle}>
								<span>{t.home.install}</span>
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
			{choosingMode ? (
				<ModeSelect
					name={trimmed}
					ready={ready}
					onClose={() => setChoosingMode(false)}
				/>
			) : null}
			<nav className={styles.legal} aria-label={t.home.legal}>
				<a href={`/terms?lang=${language}`}>{t.home.terms}</a>
				<a href={`/privacy?lang=${language}`}>{t.home.privacy}</a>
			</nav>
		</main>
	);
}
