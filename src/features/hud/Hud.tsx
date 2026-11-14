import { useEffect } from "react";
import { useStore } from "../../hooks/useStore";
import { leaveMatch } from "../game/matchController";
import type { GameSession } from "../game/session/GameSession";
import styles from "./Hud.module.scss";
import { hudStore } from "./hudStore";
import { PauseOverlay } from "./PauseOverlay";
import { VoteOverlay } from "./VoteOverlay";

export function Hud({ session }: { session: GameSession }) {
	const showMap = useStore(hudStore, (state) => state.showMap);
	const paused = useStore(hudStore, (state) => state.paused);
	const voting = useStore(hudStore, (state) => state.voting);
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
			{voting ? <VoteOverlay /> : null}
			{paused && !showMap && !voting ? (
				<PauseOverlay session={session} />
			) : null}
		</div>
	);
}
