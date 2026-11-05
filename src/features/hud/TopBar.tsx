import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { formatClock } from "../../utils/format";
import styles from "./HudParts.module.scss";
import { hudStore } from "./hudStore";

export function TopBar() {
	const t = useT();
	const state = useStore(
		hudStore,
		(hud) => ({
			remainingMs: hud.remainingMs,
			anomaliesInMs: hud.anomaliesInMs,
			score: hud.score,
			rank: hud.rank,
			players: hud.leaderboard.length,
			team: hud.team,
			teamRank: hud.teamRank,
			teamCount: hud.teamCount,
		}),
		shallowEqual,
	);
	const urgent = state.remainingMs < 60_000;
	return (
		<>
			<div className={styles.topBar}>
				<div className={[styles.timer, urgent ? styles.urgent : ""].join(" ")}>
					{formatClock(state.remainingMs)}
				</div>
				{state.anomaliesInMs > 0 ? (
					<div className={styles.incoming}>
						{t.game.hud.awakening(Math.ceil(state.anomaliesInMs / 1000))}
					</div>
				) : null}
			</div>
			<div className={styles.score}>
				<span className={styles.scoreValue}>
					{t.common.number(state.score)}
				</span>
				<span className={styles.scoreLabel}>
					{state.team === null
						? t.game.hud.scoreLine(state.rank, state.players)
						: t.game.hud.teamLine(
								t.common.teams[state.team],
								state.teamRank,
								state.teamCount,
							)}
				</span>
			</div>
		</>
	);
}
