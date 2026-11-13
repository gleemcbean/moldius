import { PLAYER_NAME_MAX_LENGTH } from "@shared/config/index";
import { HAT_PATTERNS, type HatPattern } from "@shared/hatPatterns";
import {
	type AccountProblem,
	accountMessage,
} from "@shared/i18n/accountMessages";
import { colorHex, PLAYER_COLOR_CHOICES } from "@shared/playerColors";
import {
	type AccountProfile,
	DELETE_CONFIRMATIONS,
	EMAIL_MAX_LENGTH,
	MATCH_HISTORY_LIMIT,
	PASSWORD_MAX_LENGTH,
	validateEmail,
	validatePassword,
} from "@shared/protocol/account";
import {
	accountProgress,
	hatUnlocked,
	LANTERN_TINT_COLORS,
	LANTERN_TINTS,
	type LanternTint,
	lanternUnlocked,
	REWARDS,
	type Reward,
	rewardFor,
	rewardProgress,
	rewardUnlocked,
	TAGLINES,
	type Tagline,
	taglineUnlocked,
} from "@shared/rewards";
import { type FormEvent, type InputHTMLAttributes, useState } from "react";
import { showToast } from "../../app/appStore";
import { Button } from "../../components/Button";
import { Checkbox } from "../../components/Checkbox";
import { Meter, Segmented } from "../../components/Controls";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { PageSwap } from "../../components/PageSwap";
import { TaglineBadge } from "../../components/TaglineBadge";
import { shallowEqual, useStore } from "../../hooks/useStore";
import { useLanguage, useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { rewardName, rewardRequirement } from "../challenges/rewardLabels";
import { discordStore } from "../discord/discordStore";
import { LevelProgress } from "../profile/LevelProgress";
import { settingsStore } from "../settings/settingsStore";
import styles from "./AccountModal.module.scss";
import {
	accountStore,
	cancelPasswordReset,
	changePassword,
	clearAccountNotice,
	confirmPasswordReset,
	deleteAccount,
	login,
	logout,
	refreshAccount,
	register,
	requestPasswordReset,
	saveProfile,
	setPrivateProfile,
	startDiscord,
	unlinkDiscord,
} from "./accountStore";
import { HistoryPanel } from "./MatchHistory";

interface FormError {
	text: string;
	field?: string;
}

function useProblem(): (problem: AccountProblem) => string {
	const language = useLanguage();
	return (problem) => accountMessage(language, problem.key, problem.params);
}

function TextField({
	label,
	invalid,
	...input
}: {
	label: string;
	invalid?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
	return (
		<label className={styles.textField}>
			<span className={styles.textLabel}>{label}</span>
			<input
				className={[styles.input, invalid ? styles.inputInvalid : ""].join(" ")}
				aria-invalid={invalid || undefined}
				spellCheck={false}
				data-selectable=""
				{...input}
			/>
		</label>
	);
}

function ErrorLine({ error }: { error: FormError | null }) {
	return error ? (
		<p className={styles.error} role="alert">
			{error.text}
		</p>
	) : null;
}

function DiscordButton({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	const t = useT();
	const busy = useStore(accountStore, (state) => state.discordBusy);
	return (
		<button
			type="button"
			className={styles.discordButton}
			onClick={onClick}
			disabled={busy}
			data-selectable=""
		>
			<Icon name="discord" />
			<span>{busy ? t.account.discordWaiting : label}</span>
		</button>
	);
}

type GuestMode = "login" | "register" | "forgot";

function GuestPanel() {
	const t = useT();
	const describe = useProblem();
	const playerName = useStore(settingsStore, (state) =>
		state.playerName.trim(),
	);
	const discordEnabled = useStore(
		accountStore,
		(state) => state.discordEnabled,
	);
	const [mode, setMode] = useState<GuestMode>("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [error, setError] = useState<FormError | null>(null);
	const [busy, setBusy] = useState(false);
	const [sentTo, setSentTo] = useState<{
		email: string;
		kind: "register" | "forgot";
		discord?: string | null;
		discordFailed?: boolean;
	} | null>(null);
	const registering = mode === "register";

	const switchMode = (next: GuestMode) => {
		setMode(next);
		setError(null);
		setSentTo(null);
		setPassword("");
		setConfirmation("");
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (busy) {
			return;
		}
		const emailProblem = validateEmail(email);
		if (emailProblem) {
			setError({ text: describe(emailProblem), field: "email" });
			return;
		}
		if (registering) {
			const passwordProblem = validatePassword(password, email);
			const problem =
				(playerName.length < 2 && { text: t.account.nameFirst }) ||
				(passwordProblem && {
					text: describe(passwordProblem),
					field: "password",
				}) ||
				(password !== confirmation && {
					text: describe({ key: "passwordsDiffer" }),
					field: "confirmation",
				}) ||
				null;
			if (problem) {
				setError(problem);
				return;
			}
		} else if (mode === "login" && password.length === 0) {
			setError({ text: t.account.passwordRequired, field: "password" });
			return;
		}
		setBusy(true);
		setError(null);
		if (mode === "login") {
			const result = await login(email.trim(), password);
			setBusy(false);
			if (!result.ok) {
				setError({ text: result.error, field: result.field });
				setPassword("");
				return;
			}
			showToast(t.account.signedInToast, "success");
			return;
		}
		const result =
			mode === "register"
				? await register(email.trim(), password)
				: await requestPasswordReset(email.trim());
		setBusy(false);
		setPassword("");
		setConfirmation("");
		if (!result.ok) {
			setError({ text: result.error, field: result.field });
			return;
		}
		setSentTo({
			email: email.trim(),
			kind: mode === "register" ? "register" : "forgot",
			discord:
				typeof result.value === "object" && result.value
					? result.value.discord
					: null,
			discordFailed:
				typeof result.value === "object" && result.value
					? result.value.discordFailed
					: false,
		});
	};

	if (sentTo) {
		return (
			<div className={styles.guest}>
				<div className={styles.mailSent}>
					<Icon name="check" />
					<div>
						<p className={styles.mailTitle}>
							{sentTo.kind === "register"
								? t.account.checkMailbox
								: t.account.requestSent}
						</p>
						<p className={styles.hint}>
							{sentTo.kind === "register"
								? t.account.registerSent(sentTo.email)
								: t.account.resetSent(sentTo.email)}{" "}
							{t.account.spamHint}
						</p>
						{sentTo.discord ? (
							<p className={styles.hint}>
								{t.account.registerDiscord(sentTo.discord)}
							</p>
						) : sentTo.discordFailed ? (
							<p className={styles.hint}>{t.account.registerDiscordFailed}</p>
						) : null}
					</div>
				</div>
				<div className={styles.row}>
					<Button variant="secondary" onClick={() => switchMode("login")}>
						{t.account.backToLogin}
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.guest}>
			<div className={styles.tabs}>
				<Segmented<"login" | "register">
					value={mode === "register" ? "register" : "login"}
					onChange={switchMode}
					options={[
						{ value: "login", label: t.account.tabs.login },
						{ value: "register", label: t.account.tabs.register },
					]}
				/>
			</div>
			{discordEnabled && mode !== "forgot" ? (
				<>
					<DiscordButton
						label={
							registering ? t.account.discordRegister : t.account.discordLogin
						}
						onClick={() => void startDiscord("login")}
					/>
					<p className={styles.separator}>{t.account.orEmail}</p>
				</>
			) : null}
			<form
				className={styles.form}
				onSubmit={(event) => void submit(event)}
				noValidate
			>
				{mode === "forgot" ? (
					<p className={styles.hint}>{t.account.forgotHint}</p>
				) : null}
				<TextField
					label={t.account.email}
					name="email"
					type="email"
					inputMode="email"
					value={email}
					maxLength={EMAIL_MAX_LENGTH}
					autoComplete="email"
					autoFocus
					invalid={error?.field === "email"}
					onChange={(event) => setEmail(event.target.value)}
				/>
				{mode !== "forgot" ? (
					<TextField
						label={t.account.password}
						name="password"
						type="password"
						value={password}
						maxLength={PASSWORD_MAX_LENGTH}
						autoComplete={registering ? "new-password" : "current-password"}
						invalid={error?.field === "password"}
						onChange={(event) => setPassword(event.target.value)}
					/>
				) : null}
				{registering ? (
					<TextField
						label={t.account.confirmPassword}
						name="confirmation"
						type="password"
						value={confirmation}
						maxLength={PASSWORD_MAX_LENGTH}
						autoComplete="new-password"
						invalid={error?.field === "confirmation"}
						onChange={(event) => setConfirmation(event.target.value)}
					/>
				) : null}
				{registering ? (
					<p className={styles.hint}>
						{t.account.registerHint(playerName || "…")}
					</p>
				) : null}
				<ErrorLine error={error} />
				<Button type="submit" size="large" wide disabled={busy}>
					{busy
						? t.common.wait
						: mode === "register"
							? t.account.createAccount
							: mode === "forgot"
								? t.account.receiveLink
								: t.account.signIn}
				</Button>
				{mode === "login" ? (
					<button
						type="button"
						className={styles.link}
						onClick={() => switchMode("forgot")}
					>
						{t.account.forgot}
					</button>
				) : null}
				{mode === "forgot" ? (
					<button
						type="button"
						className={styles.link}
						onClick={() => switchMode("login")}
					>
						{t.account.backToLogin}
					</button>
				) : null}
			</form>
		</div>
	);
}

function ResetPanel({ token }: { token: string }) {
	const t = useT();
	const describe = useProblem();
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [error, setError] = useState<FormError | null>(null);
	const [busy, setBusy] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const problem = validatePassword(password, "");
		if (problem) {
			setError({ text: describe(problem), field: "newPassword" });
			return;
		}
		if (password !== confirmation) {
			setError({
				text: describe({ key: "passwordsDiffer" }),
				field: "confirmation",
			});
			return;
		}
		setBusy(true);
		const result = await confirmPasswordReset(token, password);
		setBusy(false);
		if (!result.ok) {
			setError({ text: result.error, field: result.field });
			return;
		}
		showToast(t.account.resetDone, "success");
	};

	return (
		<form
			className={styles.form}
			onSubmit={(event) => void submit(event)}
			noValidate
		>
			<h3 className={styles.section}>{t.account.newPasswordTitle}</h3>
			<TextField
				label={t.account.newPassword}
				type="password"
				value={password}
				maxLength={PASSWORD_MAX_LENGTH}
				autoComplete="new-password"
				autoFocus
				invalid={error?.field === "newPassword"}
				onChange={(event) => setPassword(event.target.value)}
			/>
			<TextField
				label={t.account.confirmNewPassword}
				type="password"
				value={confirmation}
				maxLength={PASSWORD_MAX_LENGTH}
				autoComplete="new-password"
				invalid={error?.field === "confirmation"}
				onChange={(event) => setConfirmation(event.target.value)}
			/>
			<p className={styles.hint}>{t.account.otherDevices}</p>
			<ErrorLine error={error} />
			<div className={styles.row}>
				<Button variant="ghost" onClick={cancelPasswordReset}>
					{t.common.cancel}
				</Button>
				<Button type="submit" disabled={busy || !password}>
					{busy ? t.common.wait : t.common.save}
				</Button>
			</div>
		</form>
	);
}

function NoticeBanner() {
	const t = useT();
	const notice = useStore(accountStore, (state) => state.notice);
	if (!notice) {
		return null;
	}
	return (
		<p
			className={notice.tone === "success" ? styles.success : styles.error}
			role={notice.tone === "success" ? "status" : "alert"}
		>
			{notice.key ? t.account.notices[notice.key] : notice.text}
		</p>
	);
}

function ProfilePanel({ account }: { account: AccountProfile }) {
	const t = useT();
	const describe = useProblem();
	const [displayName, setDisplayName] = useState(account.displayName);
	const [color, setColor] = useState(account.color);
	const [pattern, setPattern] = useState(account.pattern);
	const [lantern, setLantern] = useState(account.lantern);
	const [tagline, setTagline] = useState(account.tagline);
	const progress = accountProgress(account);
	const lockedTitle = (
		name: string,
		unlocked: boolean,
		reward: Reward | undefined,
	) =>
		unlocked || !reward ? name : `${name} : ${rewardRequirement(t, reward)}`;
	const [error, setError] = useState<FormError | null>(null);
	const [busy, setBusy] = useState(false);
	const changed =
		displayName.trim() !== account.displayName ||
		color !== account.color ||
		pattern !== account.pattern ||
		lantern !== account.lantern ||
		tagline !== account.tagline;

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (displayName.trim().length < 2) {
			setError({
				text: describe({ key: "displayNameInvalid" }),
				field: "displayName",
			});
			return;
		}
		setBusy(true);
		const result = await saveProfile(
			displayName.trim(),
			color,
			pattern,
			lantern,
			tagline,
		);
		setBusy(false);
		if (!result.ok) {
			setError({ text: result.error, field: result.field });
			return;
		}
		setError(null);
		showToast(t.account.profile.saved, "success");
	};

	return (
		<form
			className={styles.form}
			onSubmit={(event) => void submit(event)}
			noValidate
		>
			<TextField
				label={t.account.profile.displayName}
				value={displayName}
				maxLength={PLAYER_NAME_MAX_LENGTH}
				autoComplete="off"
				invalid={error?.field === "displayName"}
				onChange={(event) => setDisplayName(event.target.value)}
			/>
			<div className={styles.textField}>
				<span className={styles.textLabel}>{t.home.hat}</span>
				<div
					className={styles.swatches}
					role="radiogroup"
					aria-label={t.home.hatColor}
				>
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
							onClick={() => setColor(choice)}
							data-selectable=""
						/>
					))}
				</div>
			</div>
			<div className={styles.textField}>
				<span className={styles.textLabel}>{t.home.pattern}</span>
				<div
					className={styles.patterns}
					role="radiogroup"
					aria-label={t.home.hatPattern}
				>
					{HAT_PATTERNS.map((choice) => {
						const unlocked = hatUnlocked(choice, progress);
						return (
							<button
								key={choice}
								type="button"
								title={lockedTitle(
									t.appearance.patterns[choice],
									unlocked,
									rewardFor("hat", choice),
								)}
								disabled={!unlocked}
								className={[
									styles.patternChoice,
									choice === pattern ? styles.swatchActive : "",
									unlocked ? "" : styles.locked,
								].join(" ")}
								onClick={() => setPattern(choice)}
								data-selectable=""
							>
								<HatPreview color={color} pattern={choice} />
							</button>
						);
					})}
				</div>
			</div>
			<div className={styles.textField}>
				<span className={styles.textLabel}>{t.home.lantern}</span>
				<div
					className={styles.patterns}
					role="radiogroup"
					aria-label={t.home.lanternTint}
				>
					{LANTERN_TINTS.map((choice) => {
						const unlocked = lanternUnlocked(choice, progress);
						return (
							<button
								key={choice}
								type="button"
								title={lockedTitle(
									t.appearance.lanterns[choice],
									unlocked,
									rewardFor("lantern", choice),
								)}
								disabled={!unlocked}
								className={[
									styles.patternChoice,
									styles.lanternChoice,
									choice === lantern ? styles.swatchActive : "",
									unlocked ? "" : styles.locked,
								].join(" ")}
								style={{ color: hexColor(LANTERN_TINT_COLORS[choice]) }}
								onClick={() => setLantern(choice)}
								data-selectable=""
							>
								<Icon name="lantern" />
							</button>
						);
					})}
				</div>
			</div>
			<div className={styles.textField}>
				<span className={styles.textLabel}>{t.home.tagline}</span>
				<div
					className={styles.patterns}
					role="radiogroup"
					aria-label={t.home.taglineHint}
				>
					{[null, ...TAGLINES].map((choice: Tagline | null) => {
						const unlocked = taglineUnlocked(choice, progress);
						const name = choice
							? t.appearance.taglines[choice]
							: t.home.noTagline;
						return (
							<button
								key={choice ?? "none"}
								type="button"
								title={
									choice
										? lockedTitle(name, unlocked, rewardFor("tagline", choice))
										: t.home.taglineHint
								}
								disabled={!unlocked}
								className={[
									styles.taglineChoice,
									choice === tagline ? styles.swatchActive : "",
									choice === null ? styles.taglineNone : "",
									unlocked ? "" : styles.locked,
								].join(" ")}
								onClick={() => setTagline(choice)}
								data-selectable=""
							>
								{name}
							</button>
						);
					})}
				</div>
			</div>
			<p className={styles.hint}>{t.account.profile.hint}</p>
			<ErrorLine error={error} />
			<div className={styles.row}>
				<Button type="submit" disabled={busy || !changed}>
					{busy ? t.account.profile.saving : t.common.save}
				</Button>
			</div>
		</form>
	);
}

function PrivacySection({ account }: { account: AccountProfile }) {
	const t = useT();
	const labels = t.account.profile;
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<FormError | null>(null);
	const toggle = async (privateProfile: boolean) => {
		setBusy(true);
		const result = await setPrivateProfile(privateProfile);
		setBusy(false);
		if (!result.ok) {
			setError({ text: result.error });
			return;
		}
		setError(null);
		showToast(privateProfile ? labels.privateOn : labels.privateOff, "info");
	};
	return (
		<div className={styles.form}>
			<h3 className={styles.section}>{labels.privacyTitle}</h3>
			<Checkbox
				checked={account.privateProfile}
				disabled={busy}
				onChange={(value) => void toggle(value)}
				icon={<Icon name="lock" />}
				label={labels.privateProfile}
				hint={labels.privateProfileHint}
			/>
			<ErrorLine error={error} />
		</div>
	);
}

function PasswordForm() {
	const t = useT();
	const describe = useProblem();
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [error, setError] = useState<FormError | null>(null);
	const [busy, setBusy] = useState(false);
	const email = useStore(accountStore, (state) => state.account?.email ?? "");
	const hasPassword = useStore(
		accountStore,
		(state) => state.account?.hasPassword ?? true,
	);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const problem = validatePassword(next, email);
		if (problem) {
			setError({ text: describe(problem), field: "newPassword" });
			return;
		}
		if (next !== confirmation) {
			setError({
				text: describe({ key: "passwordsDiffer" }),
				field: "confirmation",
			});
			return;
		}
		setBusy(true);
		const result = await changePassword(current, next);
		setBusy(false);
		setCurrent("");
		if (!result.ok) {
			setError({ text: result.error, field: result.field });
			return;
		}
		setNext("");
		setConfirmation("");
		setError(null);
		showToast(t.account.security.changed, "success");
	};

	if (!hasPassword) {
		return (
			<div className={styles.form}>
				<h3 className={styles.section}>{t.account.security.passwordTitle}</h3>
				<p className={styles.hint}>
					{email
						? t.account.security.noPassword(email)
						: t.account.security.discordOnly}
				</p>
			</div>
		);
	}

	return (
		<form
			className={styles.form}
			onSubmit={(event) => void submit(event)}
			noValidate
		>
			<h3 className={styles.section}>{t.account.security.changeTitle}</h3>
			<input
				type="email"
				name="email"
				value={email}
				autoComplete="username"
				readOnly
				hidden
			/>
			<TextField
				label={t.account.security.current}
				type="password"
				value={current}
				maxLength={PASSWORD_MAX_LENGTH}
				autoComplete="current-password"
				invalid={error?.field === "currentPassword"}
				onChange={(event) => setCurrent(event.target.value)}
			/>
			<TextField
				label={t.account.newPassword}
				type="password"
				value={next}
				maxLength={PASSWORD_MAX_LENGTH}
				autoComplete="new-password"
				invalid={error?.field === "newPassword"}
				onChange={(event) => setNext(event.target.value)}
			/>
			<TextField
				label={t.account.confirmNewPassword}
				type="password"
				value={confirmation}
				maxLength={PASSWORD_MAX_LENGTH}
				autoComplete="new-password"
				invalid={error?.field === "confirmation"}
				onChange={(event) => setConfirmation(event.target.value)}
			/>
			<ErrorLine error={error} />
			<div className={styles.row}>
				<Button type="submit" disabled={busy || !current || !next}>
					{busy ? t.common.wait : t.account.security.change}
				</Button>
			</div>
		</form>
	);
}

function DeleteForm() {
	const t = useT();
	const language = useLanguage();
	const labels = t.account.security;
	const [open, setOpen] = useState(false);
	const [password, setPassword] = useState("");
	const [error, setError] = useState<FormError | null>(null);
	const [busy, setBusy] = useState(false);
	const hasPassword = useStore(
		accountStore,
		(state) => state.account?.hasPassword ?? true,
	);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setBusy(true);
		const result = hasPassword
			? await deleteAccount(password, "")
			: await deleteAccount("", password.trim().toUpperCase());
		setBusy(false);
		setPassword("");
		if (!result.ok) {
			setError({ text: result.error, field: result.field });
			return;
		}
		showToast(labels.deleted, "info");
	};

	return (
		<form
			className={styles.form}
			onSubmit={(event) => void submit(event)}
			noValidate
		>
			<h3 className={styles.section}>{labels.deleteTitle}</h3>
			<p className={styles.hint}>{labels.deleteHint}</p>
			{open ? (
				<>
					<TextField
						label={
							hasPassword
								? labels.deleteWithPassword
								: labels.deleteWithWord(DELETE_CONFIRMATIONS[language])
						}
						type={hasPassword ? "password" : "text"}
						value={password}
						maxLength={hasPassword ? PASSWORD_MAX_LENGTH : 20}
						autoComplete={hasPassword ? "current-password" : "off"}
						invalid={
							error?.field === "password" || error?.field === "confirmation"
						}
						onChange={(event) => setPassword(event.target.value)}
					/>
					<ErrorLine error={error} />
					<div className={styles.row}>
						<Button variant="ghost" onClick={() => setOpen(false)}>
							{t.common.cancel}
						</Button>
						<Button type="submit" variant="danger" disabled={busy || !password}>
							{busy ? labels.deleting : labels.deleteForever}
						</Button>
					</div>
				</>
			) : (
				<div className={styles.row}>
					<Button variant="danger" onClick={() => setOpen(true)}>
						{labels.deleteMine}
					</Button>
				</div>
			)}
		</form>
	);
}

function DiscordSection({ account }: { account: AccountProfile }) {
	const t = useT();
	const labels = t.account.security;
	const discordEnabled = useStore(
		accountStore,
		(state) => state.discordEnabled,
	);
	const [error, setError] = useState<FormError | null>(null);
	const [busy, setBusy] = useState(false);
	const appDiscord = useStore(discordStore, (state) => state);
	if (!account.discord && !discordEnabled) {
		return null;
	}
	const appNeedsDiscord =
		account.discord !== null &&
		discordEnabled &&
		appDiscord.available &&
		appDiscord.status !== "ready" &&
		appDiscord.status !== "connecting";
	const canUnlink = account.hasPassword && account.email !== null;
	const unlink = async () => {
		setBusy(true);
		const result = await unlinkDiscord();
		setBusy(false);
		if (!result.ok) {
			setError({ text: result.error });
			return;
		}
		setError(null);
		showToast(labels.unlinked, "info");
	};
	return (
		<div className={styles.form}>
			<h3 className={styles.section}>Discord</h3>
			{account.discord ? (
				<div className={styles.discordLinked}>
					{account.discord.avatarUrl ? (
						<img
							className={styles.discordAvatar}
							src={account.discord.avatarUrl}
							alt=""
						/>
					) : (
						<span className={styles.discordAvatar}>
							<Icon name="discord" />
						</span>
					)}
					<div>
						<strong>{account.discord.username}</strong>
						<span className={styles.hint}>
							{canUnlink ? labels.discordBoth : labels.discordSole}
						</span>
					</div>
					<Button
						variant="ghost"
						disabled={busy || !canUnlink}
						onClick={() => void unlink()}
					>
						{labels.unlink}
					</Button>
				</div>
			) : null}
			{appNeedsDiscord ? (
				<>
					<p className={styles.hint}>{labels.appHint}</p>
					<DiscordButton
						label={labels.appConnect}
						onClick={() => void startDiscord("link")}
					/>
				</>
			) : null}
			{account.discord ? null : (
				<>
					<p className={styles.hint}>{labels.linkHint}</p>
					<DiscordButton
						label={labels.link}
						onClick={() => void startDiscord("link")}
					/>
				</>
			)}
			<ErrorLine error={error} />
		</div>
	);
}

function SecurityPanel({ account }: { account: AccountProfile }) {
	return (
		<div className={styles.security}>
			<DiscordSection account={account} />
			<PasswordForm />
			<DeleteForm />
		</div>
	);
}

type AccountTab = "history" | "rewards" | "profile" | "security";

const ACCOUNT_TABS: readonly AccountTab[] = [
	"history",
	"rewards",
	"profile",
	"security",
];

function RewardCard({
	reward,
	account,
}: {
	reward: Reward;
	account: AccountProfile;
}) {
	const t = useT();
	const stats = accountProgress(account);
	const unlocked = rewardUnlocked(reward, stats);
	const { value, target } = rewardProgress(reward, stats);
	const name = rewardName(t, reward);
	return (
		<li className={unlocked ? styles.rewardOn : styles.rewardOff}>
			<span className={styles.rewardPreview}>
				{reward.kind === "hat" ? (
					<HatPreview
						color={account.color}
						pattern={reward.value as HatPattern}
					/>
				) : reward.kind === "tagline" ? (
					<TaglineBadge tagline={reward.value as Tagline} chip />
				) : (
					<span
						className={styles.rewardLantern}
						style={{
							color: hexColor(LANTERN_TINT_COLORS[reward.value as LanternTint]),
						}}
					>
						<Icon name="lantern" />
					</span>
				)}
			</span>
			<span className={styles.rewardBody}>
				<strong>{name}</strong>
				{unlocked ? (
					<span>{t.account.summary.rewardUnlocked}</span>
				) : (
					<>
						<span>{rewardRequirement(t, reward)}</span>
						<span className={styles.rewardProgress}>
							<Meter value={value} max={target} label={name} />
							<span className={styles.rewardCount}>
								{value} / {target}
							</span>
						</span>
					</>
				)}
			</span>
		</li>
	);
}

function RewardsPanel({ account }: { account: AccountProfile }) {
	const t = useT();
	const groups = [
		{ kind: "hat", title: t.home.hatPattern },
		{ kind: "lantern", title: t.home.lanternTint },
		{ kind: "tagline", title: t.home.tagline },
	] as const;
	return (
		<div className={styles.rewards}>
			{groups.map(({ kind, title }) => {
				const rewards = REWARDS.filter((reward) => reward.kind === kind);
				const done = rewards.filter((reward) =>
					rewardUnlocked(reward, accountProgress(account)),
				).length;
				return (
					<section key={kind}>
						<h3 className={styles.section}>
							{title} ({done} / {rewards.length})
						</h3>
						<ul>
							{rewards.map((reward) => (
								<RewardCard
									key={reward.value}
									reward={reward}
									account={account}
								/>
							))}
						</ul>
					</section>
				);
			})}
		</div>
	);
}

function AccountPanel({ account }: { account: AccountProfile }) {
	const t = useT();
	const labels = t.account.summary;
	const [tab, setTab] = useState<AccountTab>("history");
	const { stats } = account;
	return (
		<div className={styles.account}>
			<section className={styles.summary}>
				<div className={styles.identity}>
					<span className={styles.hat}>
						<HatPreview color={account.color} pattern={account.pattern} />
					</span>
					<div>
						<strong className={styles.displayName}>
							{account.displayName}
						</strong>
						<span className={styles.username}>
							{account.email ??
								labels.discord(account.discord?.username ?? null)}{" "}
							· {labels.memberSince(new Date(account.createdAt))}
						</span>
					</div>
					<Button
						variant="ghost"
						size="small"
						icon={<Icon name="door" />}
						onClick={() => {
							void logout().then(() => showToast(labels.signedOut, "info"));
						}}
					>
						{labels.signOut}
					</Button>
				</div>
				<LevelProgress xp={stats.xp} />
				<dl className={styles.stats}>
					<div>
						<dt>{labels.games}</dt>
						<dd>{stats.gamesPlayed}</dd>
					</div>
					<div>
						<dt>{labels.wins}</dt>
						<dd>{stats.wins}</dd>
					</div>
					<div>
						<dt>{labels.best}</dt>
						<dd>{t.common.number(stats.bestScore)}</dd>
					</div>
					<div>
						<dt>{labels.total}</dt>
						<dd>{t.common.number(stats.totalScore)}</dd>
					</div>
				</dl>
			</section>
			<div className={styles.tabs}>
				<Segmented<AccountTab>
					value={tab}
					onChange={setTab}
					options={[
						{ value: "history", label: t.account.panels.history },
						{ value: "rewards", label: t.account.panels.rewards },
						{ value: "profile", label: t.account.panels.profile },
						{ value: "security", label: t.account.panels.security },
					]}
				/>
			</div>
			<PageSwap page={tab} order={ACCOUNT_TABS}>
				{tab === "history" ? <HistoryPanel /> : null}
				{tab === "rewards" ? <RewardsPanel account={account} /> : null}
				{tab === "profile" ? (
					<div className={styles.security}>
						<ProfilePanel account={account} />
						<PrivacySection account={account} />
					</div>
				) : null}
				{tab === "security" ? <SecurityPanel account={account} /> : null}
			</PageSwap>
		</div>
	);
}

export function AccountModal({ onClose }: { onClose: () => void }) {
	const t = useT();
	const { status, account, resetToken } = useStore(
		accountStore,
		(state) => ({
			status: state.status,
			account: state.account,
			resetToken: state.resetToken,
		}),
		shallowEqual,
	);
	const signedIn = status === "signed-in" && account !== null;
	const close = () => {
		clearAccountNotice();
		cancelPasswordReset();
		onClose();
	};
	if (resetToken && (status === "guest" || status === "signed-in")) {
		return (
			<Modal title={t.account.titleReset} onClose={close}>
				<ResetPanel token={resetToken} />
			</Modal>
		);
	}
	return (
		<Modal
			title={signedIn ? t.account.titleSignedIn : t.account.titleGuest}
			onClose={close}
			wide={signedIn}
		>
			<NoticeBanner />
			{status === "loading" ? (
				<p className={styles.note}>{t.account.loading}</p>
			) : null}
			{status === "disabled" ? (
				<p className={styles.notice}>{t.account.disabled}</p>
			) : null}
			{status === "unavailable" ? (
				<div className={styles.form}>
					<p className={styles.notice}>{t.account.unavailable}</p>
					<div className={styles.row}>
						<Button variant="secondary" onClick={() => void refreshAccount()}>
							{t.account.retry}
						</Button>
					</div>
				</div>
			) : null}
			{status === "guest" ? <GuestPanel /> : null}
			{signedIn ? <AccountPanel account={account} /> : null}
		</Modal>
	);
}
