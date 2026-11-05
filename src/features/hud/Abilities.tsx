import { keyLabel } from "../../config/controls";
import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { settingsStore } from "../settings/settingsStore";
import styles from "./HudParts.module.scss";
import { hudStore } from "./hudStore";

function Ability({
	label,
	keyCode,
	readyAt,
	now,
	duration,
}: {
	label: string;
	keyCode: string;
	readyAt: number;
	now: number;
	duration: number;
}) {
	const remaining = Math.max(0, readyAt - now);
	return (
		<div
			className={[styles.ability, remaining > 0 ? styles.cooling : ""].join(
				" ",
			)}
		>
			<span className={styles.abilityKey}>{keyLabel(keyCode)}</span>
			<span className={styles.abilityLabel}>{label}</span>
			<span
				className={styles.abilityFill}
				style={{ width: `${(1 - remaining / duration) * 100}%` }}
			/>
		</div>
	);
}

export function Abilities() {
	const t = useT();
	const state = useStore(
		hudStore,
		(hud) => ({
			push: hud.pushReadyAt,
			shout: hud.shoutReadyAt,
			now: hud.serverNow,
		}),
		shallowEqual,
	);
	const keys = useStore(settingsStore, (settings) => settings.keys);
	return (
		<div className={styles.abilities}>
			<Ability
				label={t.game.hud.push}
				keyCode={keys.push}
				readyAt={state.push}
				now={state.now}
				duration={4500}
			/>
			<Ability
				label={t.game.hud.shout}
				keyCode={keys.shout}
				readyAt={state.shout}
				now={state.now}
				duration={8000}
			/>
			<div className={styles.ability}>
				<span className={styles.abilityKey}>{keyLabel(keys.grimoire)}</span>
				<span className={styles.abilityLabel}>{t.game.hud.grimoire}</span>
			</div>
		</div>
	);
}
