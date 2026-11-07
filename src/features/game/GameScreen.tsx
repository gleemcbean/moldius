import { useEffect, useRef } from "react";
import { useStore } from "../../hooks/useStore";
import { Hud } from "../hud/Hud";
import styles from "./GameScreen.module.scss";
import { currentSession } from "./matchController";
import { ReplayOverlay } from "./ReplayOverlay";
import { replayStore } from "./replayStore";

export function GameScreen() {
	const host = useRef<HTMLDivElement>(null);
	const session = currentSession();
	const replaying = useStore(replayStore, (state) => state.active);
	useEffect(() => {
		if (!session || !host.current) {
			return;
		}
		session.attach(host.current);
		return () => session.detach();
	}, [session]);
	return (
		<main className={styles.game}>
			<div ref={host} className={styles.viewport} />
			{session && replaying ? <ReplayOverlay session={session} /> : null}
			{session && !replaying ? <Hud session={session} /> : null}
		</main>
	);
}
