import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import type { GameSession } from "../game/session/GameSession";
import { Leaderboard } from "../leaderboard/Leaderboard";
import { BigMap } from "../map/BigMap";
import { settingsStore } from "../settings/settingsStore";
import { Abilities } from "./Abilities";
import { CastPanel } from "./CastPanel";
import { DevTranscript } from "./DevTranscript";
import styles from "./Hud.module.scss";
import { hudStore } from "./hudStore";
import { Minimap } from "./Minimap";
import { NoiseGauge } from "./NoiseGauge";
import { AltarPanel, Hotbar, Inventory, TutorialPanel } from "./OccultHud";
import { Overlays } from "./Overlays";
import { PauseOverlay } from "./PauseOverlay";
import { StatusBars } from "./StatusBars";
import { TopBar } from "./TopBar";

function Prompt() {
	const prompt = useStore(hudStore, (state) => state.prompt);
	return (
		<div className={styles.center}>
			<div className={styles.crosshair} />
			{prompt ? (
				<div className={styles.prompt}>
					<span className={styles.key}>E</span> {prompt}
				</div>
			) : null}
		</div>
	);
}

function Feedback() {
	const feedback = useStore(hudStore, (state) => state.feedback);
	if (!feedback) {
		return null;
	}
	return (
		<div
			key={feedback.id}
			className={[styles.feedback, styles[feedback.tone]].join(" ")}
		>
			{feedback.text}
		</div>
	);
}

function Fps() {
	const t = useT();
	const fps = useStore(hudStore, (state) => state.fps);
	const visible = useStore(settingsStore, (state) => state.showFps);
	return visible ? (
		<div className={styles.fps}>{t.game.hud.fps(fps)}</div>
	) : null;
}

export function Hud({ session }: { session: GameSession }) {
	const showLeaderboard = useStore(hudStore, (state) => state.showLeaderboard);
	const showMap = useStore(hudStore, (state) => state.showMap);
	const paused = useStore(hudStore, (state) => state.paused);
	return (
		<div className={styles.hud}>
			<Overlays />
			<Minimap session={session} />
			<TopBar />
			<StatusBars />
			<Prompt />
			<CastPanel />
			<Inventory />
			<Hotbar />
			<AltarPanel />
			<TutorialPanel />
			<DevTranscript />
			<Feedback />
			<Abilities />
			<NoiseGauge />
			<Fps />
			{showLeaderboard ? <Leaderboard /> : null}
			{showMap ? <BigMap session={session} /> : null}
			{paused && !showMap ? <PauseOverlay session={session} /> : null}
		</div>
	);
}
