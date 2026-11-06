import { useEffect } from "react";
import { useStore } from "../../hooks/useStore";
import { leaveMatch } from "../game/matchController";
import type { GameSession } from "../game/session/GameSession";
import { Leaderboard } from "../leaderboard/Leaderboard";
import styles from "./Hud.module.scss";
import { hudStore } from "./hudStore";
import { PauseOverlay } from "./PauseOverlay";

export function Hud({ session }: { session: GameSession }) {
	const showMap = useStore(hudStore, (state) => state.showMap);
	const paused = useStore(hudStore, (state) => state.paused);
	const showLeaderboard = useStore(hudStore, (state) => state.showLeaderboard);
	const finished = useStore(
		hudStore,
		(state) => state.tutorial?.finished ?? false,
	);
	useEffect(() => {
		if (finished) {
			leaveMatch();
		}
	}, [finished]);
	return (
		<div className={styles.hud}>
			{showLeaderboard && !paused && !showMap ? <Leaderboard /> : null}
			{paused && !showMap ? <PauseOverlay session={session} /> : null}
		</div>
	);
}
