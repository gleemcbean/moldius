import { PadGlyphIcon } from "../../components/KeyText";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { padHintsStore } from "./menuNavigator";
import styles from "./PadHints.module.scss";

export function PadHints() {
	const t = useT();
	const labels = t.settings.controls;
	const visible = useStore(padHintsStore, (state) => state.visible);
	const tabs = useStore(padHintsStore, (state) => state.tabs);
	const options = useStore(padHintsStore, (state) => state.options);

	if (!visible) {
		return null;
	}

	return (
		<div className={styles.bar} aria-hidden="true">
			<span className={styles.hint}>
				<PadGlyphIcon glyph="a" />
				{labels.padHintSelect}
			</span>
			<span className={styles.hint}>
				<PadGlyphIcon glyph="b" />
				{labels.padHintBack}
			</span>
			{options ? (
				<span className={styles.hint}>
					<PadGlyphIcon glyph="y" />
					{labels.padHintOptions}
				</span>
			) : null}
			{tabs ? (
				<span className={styles.hint}>
					<span className={styles.shoulder}>LB</span>
					<span className={styles.shoulder}>RB</span>
					{labels.padHintTabs}
				</span>
			) : null}
		</div>
	);
}
