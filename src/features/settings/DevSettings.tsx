import { DEV_MODE_IDS } from "@shared/devModes";
import { Field, Toggle } from "../../components/Controls";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { devModesStore, setDevMode } from "./devModesStore";
import styles from "./SettingsModal.module.scss";

export function DevSettings() {
	const t = useT();
	const labels = t.settings.dev;
	const modes = useStore(devModesStore, (state) => state);
	return (
		<div>
			<h3 className={styles.section}>{labels.title}</h3>
			<p className={styles.notice}>{labels.note}</p>
			{DEV_MODE_IDS.map((id) => (
				<Field
					key={id}
					label={labels.modes[id].label}
					hint={labels.modes[id].hint}
				>
					<Toggle
						checked={modes[id]}
						label={labels.modes[id].label}
						onChange={(enabled) => setDevMode(id, enabled)}
					/>
				</Field>
			))}
		</div>
	);
}
