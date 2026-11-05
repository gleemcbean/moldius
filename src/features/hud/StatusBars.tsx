import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import styles from "./HudParts.module.scss";
import { hudStore } from "./hudStore";

function Bar({
	label,
	value,
	tone,
	locked,
}: {
	label: string;
	value: number;
	tone: "energy" | "health";
	locked?: boolean;
}) {
	return (
		<div className={styles.barRow}>
			<span className={styles.barLabel}>{label}</span>
			<div
				className={[styles.bar, styles[tone], locked ? styles.locked : ""].join(
					" ",
				)}
			>
				<div
					className={styles.barFill}
					style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
				/>
				<span className={styles.barValue}>{Math.round(value)}</span>
			</div>
		</div>
	);
}

export function StatusBars() {
	const t = useT();
	const state = useStore(
		hudStore,
		(hud) => ({
			energy: hud.energy,
			health: hud.health,
			sprintLocked: hud.sprintLocked,
		}),
		shallowEqual,
	);
	return (
		<div className={styles.status}>
			<Bar
				label={t.game.hud.energy}
				value={state.energy}
				tone="energy"
				locked={state.sprintLocked}
			/>
			<Bar label={t.game.hud.health} value={state.health} tone="health" />
		</div>
	);
}
