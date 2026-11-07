import { keyLabel } from "../../config/controls";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { settingsStore } from "../settings/settingsStore";
import styles from "./Hud.module.scss";
import { hudStore } from "./hudStore";

export function WalkieChip() {
	const t = useT();
	const labels = t.game.walkie;
	const held = useStore(hudStore, (state) => state.walkieHeld);
	const talking = useStore(hudStore, (state) => state.walkieTalking);
	const hearing = useStore(hudStore, (state) => state.walkieHearing);
	const key = useStore(settingsStore, (state) => state.keys.radio);
	const hidden = useStore(hudStore, (state) => state.showMap || state.paused);
	if (!held || hidden) {
		return null;
	}
	return (
		<div
			className={[
				styles.walkie,
				talking ? styles.walkieTalking : "",
				hearing ? styles.walkieHearing : "",
			].join(" ")}
		>
			{talking
				? labels.talking
				: hearing
					? labels.hearing(hearing)
					: labels.idle(keyLabel(key))}
		</div>
	);
}
