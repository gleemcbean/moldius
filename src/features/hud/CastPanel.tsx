import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import styles from "./HudParts.module.scss";
import { hudStore } from "./hudStore";

export function CastPanel() {
	const t = useT();
	const cast = useStore(
		hudStore,
		(state) => ({
			sent: state.castPhase === "sent",
			howler: state.howlerNearby,
		}),
		shallowEqual,
	);
	return (
		<>
			{cast.howler ? (
				<div className={styles.howler}>{t.game.cast.howler}</div>
			) : null}
			{cast.sent ? (
				<div className={styles.cast}>
					<p className={styles.castTitle}>{t.game.cast.sent}</p>
				</div>
			) : null}
		</>
	);
}
