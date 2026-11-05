import {
	PLAYER_NAME_MAX_LENGTH,
	PRIVATE_CODE_LENGTH,
} from "@shared/config/index";
import { HAT_PATTERNS } from "@shared/hatPatterns";
import { inviteCodeFromText } from "@shared/inviteLink";
import { colorHex, PLAYER_COLOR_CHOICES } from "@shared/playerColors";
import { useEffect, useMemo, useState } from "react";
import { openOverlay } from "../../app/appStore";
import { Button } from "../../components/Button";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { SelectorGroup } from "../../components/SelectorGroup";
import { useStore } from "../../hooks/useStore";
import { useLanguage, useT } from "../../i18n";
import type { Language } from "../../i18n/language";
import { defaultNames } from "../../i18n/names";
import { accountStore } from "../account/accountStore";
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
import { HomeBackdrop } from "./HomeBackdrop";
import styles from "./HomeScreen.module.scss";

function pickSuggestions(language: Language, current: string): string[] {
	const pool = defaultNames(language).filter((name) => name !== current);
	const shuffled = [...pool].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, 3);
}

export function HomeScreen() {
	const t = useT();
	const language = useLanguage();
	const name = useStore(settingsStore, (state) => state.playerName);
	const color = useStore(settingsStore, (state) => state.playerColor);
	const pattern = useStore(settingsStore, (state) => state.playerPattern);
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
					<div
						className={styles.colorRow}
						role="radiogroup"
						aria-label={t.home.hatColor}
					>
						<span className={styles.colorLabel}>{t.home.hat}</span>
						{PLAYER_COLOR_CHOICES.map((choice) => (
							<button
								key={choice}
								type="button"
								title={t.appearance.colors[colorHex(choice)]}
								className={[
									styles.swatch,
									choice === color ? styles.swatchActive : "",
								].join(" ")}
								style={{ background: `#${colorHex(choice)}` }}
								onClick={() => updateSettings({ playerColor: choice })}
								data-selectable=""
							/>
						))}
					</div>
					<div
						className={styles.patternRow}
						role="radiogroup"
						aria-label={t.home.hatPattern}
					>
						<span className={styles.colorLabel}>{t.home.pattern}</span>
						{HAT_PATTERNS.map((choice) => (
							<button
								key={choice}
								type="button"
								title={t.appearance.patterns[choice]}
								className={[
									styles.patternChoice,
									choice === pattern ? styles.patternActive : "",
								].join(" ")}
								onClick={() => updateSettings({ playerPattern: choice })}
								data-selectable=""
							>
								<HatPreview color={color} pattern={choice} />
							</button>
						))}
					</div>
				</section>

				<div className={styles.actions}>
					<Button
						size="large"
						wide
						icon={<Icon name="play" />}
						disabled={!ready}
						onClick={() => quickJoin(trimmed)}
					>
						{t.home.quickJoin}
					</Button>
					<Button
						variant="secondary"
						wide
						icon={<Icon name="lock" />}
						disabled={!ready}
						onClick={() => createPrivateLobby(trimmed)}
					>
						{t.home.createPrivate}
					</Button>
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
					<Button
						variant="secondary"
						disabled={!ready}
						onClick={() => startTutorial(trimmed)}
					>
						{t.home.tutorial}
					</Button>
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
