import { useEffect } from "react";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { settingsStore } from "../settings/settingsStore";
import { MicLevelMeter } from "../voice/MicLevelMeter";
import { micManager, micStore } from "../voice/micManager";
import {
	prepareSpeechRecognition,
	speechEngine,
} from "../voice/speechRecognizer";
import styles from "./LobbyScreen.module.scss";

export function MicPanel() {
	const t = useT();
	const mic = useStore(
		micStore,
		(state) => ({
			status: state.status,
			level: state.level,
			label: state.deviceLabel,
		}),
		shallowEqual,
	);
	const ok = mic.status === "ready";
	useEffect(() => {
		prepareSpeechRecognition();
	}, []);
	return (
		<section className={styles.micPanel}>
			<div className={styles.micHead}>
				<span className={ok ? styles.micOk : styles.micMissing}>
					<Icon name={ok ? "mic" : "micOff"} />
				</span>
				<div>
					<p className={styles.micTitle}>
						{ok ? mic.label : t.lobby.mic.title}
					</p>
					<p className={styles.micMessage}>{t.game.mic.status[mic.status]}</p>
				</div>
				{!ok && mic.status !== "requesting" ? (
					<Button
						size="small"
						variant="secondary"
						onClick={() =>
							void micManager.acquire(settingsStore.get().micDeviceId)
						}
					>
						{t.lobby.mic.retry}
					</Button>
				) : null}
			</div>
			<MicLevelMeter level={mic.level} label={t.lobby.mic.meter} />
			<p className={styles.micHint}>
				{t.lobby.mic.hint}{" "}
				{
					{
						native: t.lobby.mic.speechAvailable,
						vosk: t.lobby.mic.speechOffline,
						none: t.lobby.mic.speechMissing,
					}[speechEngine() ?? "none"]
				}
			</p>
		</section>
	);
}
