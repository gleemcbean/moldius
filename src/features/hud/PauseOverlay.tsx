import { openOverlay } from "../../app/appStore";
import { desktopApp } from "../../app/desktopApp";
import { Button } from "../../components/Button";
import { SelectorGroup } from "../../components/SelectorGroup";
import { useT } from "../../i18n";
import { keyboardLockSupported } from "../../utils/fullscreen";
import { leaveMatch } from "../game/matchController";
import type { GameSession } from "../game/session/GameSession";
import styles from "./HudParts.module.scss";

export function PauseOverlay({ session }: { session: GameSession }) {
	const t = useT();
	return (
		<div className={styles.pause}>
			<SelectorGroup className={styles.pausePanel}>
				<h2>{t.game.pause.title}</h2>
				<p>{t.game.pause.text}</p>
				<Button size="large" wide onClick={() => session.resumePointer()}>
					{t.game.pause.resume}
				</Button>
				<Button
					variant="secondary"
					wide
					onClick={() => openOverlay("settings")}
				>
					{t.game.pause.settings}
				</Button>
				<Button variant="danger" wide onClick={leaveMatch}>
					{t.game.pause.leave}
				</Button>
				{desktopApp ? (
					<Button variant="ghost" wide onClick={() => desktopApp?.quit()}>
						{t.home.quitGame}
					</Button>
				) : null}
				<p className={styles.pauseHint}>
					{keyboardLockSupported()
						? t.game.pause.keyboardLock
						: t.game.pause.noKeyboardLock}
				</p>
			</SelectorGroup>
		</div>
	);
}
