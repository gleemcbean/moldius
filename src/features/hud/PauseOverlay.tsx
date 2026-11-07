import { useEffect, useState } from "react";
import { openOverlay } from "../../app/appStore";
import { Button } from "../../components/Button";
import { SelectorGroup } from "../../components/SelectorGroup";
import { useT } from "../../i18n";
import {
	enterGameFullscreen,
	exitGameFullscreen,
	fullscreenSupported,
	isFullscreen,
	keyboardLockSupported,
} from "../../utils/fullscreen";
import { leaveMatch } from "../game/matchController";
import type { GameSession } from "../game/session/GameSession";
import { settingsStore } from "../settings/settingsStore";
import styles from "./HudParts.module.scss";

function useFullscreenState(): boolean {
	const [active, setActive] = useState(isFullscreen);
	useEffect(() => {
		const update = () => setActive(isFullscreen());
		document.addEventListener("fullscreenchange", update);
		return () => document.removeEventListener("fullscreenchange", update);
	}, []);
	return active;
}

export function PauseOverlay({ session }: { session: GameSession }) {
	const t = useT();
	const fullscreen = useFullscreenState();
	const toggleFullscreen = async () => {
		if (fullscreen) {
			await exitGameFullscreen();
			return;
		}
		await enterGameFullscreen(Object.values(settingsStore.get().keys));
		session.resumePointer();
	};
	return (
		<div className={styles.pause}>
			<SelectorGroup className={styles.pausePanel}>
				<h2>{t.game.pause.title}</h2>
				<p>{t.game.pause.text}</p>
				<Button size="large" wide onClick={() => session.resumePointer()}>
					{t.game.pause.resume}
				</Button>
				{fullscreenSupported() ? (
					<Button
						variant="secondary"
						wide
						onClick={() => void toggleFullscreen()}
					>
						{fullscreen ? t.game.pause.exitFullscreen : t.game.pause.fullscreen}
					</Button>
				) : null}
				<Button
					variant="secondary"
					wide
					onClick={() => openOverlay("challenges")}
				>
					{t.challenges.button}
				</Button>
				<Button
					variant="secondary"
					wide
					onClick={() => openOverlay("settings")}
				>
					{t.game.pause.settings}
				</Button>
				<Button variant="ghost" wide onClick={leaveMatch}>
					{t.game.pause.leave}
				</Button>
				<p className={styles.pauseHint}>
					{keyboardLockSupported()
						? t.game.pause.keyboardLock
						: t.game.pause.noKeyboardLock}
				</p>
			</SelectorGroup>
		</div>
	);
}
