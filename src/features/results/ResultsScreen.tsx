import type { MatchResultEntry } from "@shared/protocol/game";
import { TEAM_COLORS } from "@shared/teams";
import { useEffect } from "react";
import { Button } from "../../components/Button";
import { SelectorGroup } from "../../components/SelectorGroup";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { accountStore, refreshAccount } from "../account/accountStore";
import { closeResults } from "../game/matchController";
import { matchStore } from "../game/matchStore";
import { sessionStore } from "../network/sessionStore";
import styles from "./ResultsScreen.module.scss";

export function ResultsScreen() {
	const t = useT();
	const labels = t.game.results;
	const results = useStore(matchStore, (state) => state.results);
	const selfId = useStore(sessionStore, (state) => state.playerId);
	const email = useStore(accountStore, (state) => state.account?.email ?? null);
	useEffect(() => {
		if (!email) {
			return;
		}
		const timer = window.setTimeout(() => void refreshAccount(), 1500);
		return () => window.clearTimeout(timer);
	}, [email]);
	if (!results) {
		return null;
	}
	const winner = results.entries.find(
		(entry) => entry.playerId === results.winnerId,
	);
	const winningTeam = results.teams.find(
		(standing) => standing.team === results.winnerTeam,
	);
	const row = (entry: MatchResultEntry, rank: number | null) => (
		<li
			key={entry.playerId}
			className={[
				entry.playerId === selfId ? styles.self : "",
				rank === null ? styles.member : "",
			].join(" ")}
		>
			<span className={styles.rank}>{rank}</span>
			<span
				className={styles.swatch}
				style={{ background: hexColor(entry.color) }}
			/>
			<span className={styles.name}>{entry.name}</span>
			<span className={styles.stat}>{labels.captures(entry.captures)}</span>
			<span className={styles.stat}>{labels.deaths(entry.deaths)}</span>
			<span className={styles.score}>{t.common.points(entry.score)}</span>
		</li>
	);
	return (
		<main className={styles.results}>
			<SelectorGroup className={styles.panel}>
				<p className={styles.kicker}>{labels.kicker}</p>
				<h1 className={styles.title}>{labels.title}</h1>
				<p className={styles.winner}>
					{winningTeam
						? labels.teamWinner(
								t.common.teams[winningTeam.team],
								t.common.number(winningTeam.score),
							)
						: winner
							? labels.winner(winner.name, t.common.number(winner.score))
							: labels.noWinner}
				</p>
				<ol className={styles.table}>
					{results.teams.length > 0
						? results.teams.flatMap((standing, index) => [
								<li key={`team-${standing.team}`} className={styles.teamRow}>
									<span className={styles.rank}>{index + 1}</span>
									<span
										className={styles.swatch}
										style={{ background: hexColor(TEAM_COLORS[standing.team]) }}
									/>
									<span className={styles.name}>
										{t.common.teams[standing.team]}
									</span>
									<span className={styles.stat}>
										{labels.captures(standing.captures)}
									</span>
									<span className={styles.stat}>
										{labels.deaths(standing.deaths)}
									</span>
									<span className={styles.score}>
										{t.common.points(standing.score)}
									</span>
								</li>,
								...results.entries
									.filter((entry) => entry.team === standing.team)
									.map((entry) => row(entry, null)),
							])
						: results.entries.map((entry, index) => row(entry, index + 1))}
				</ol>
				{email ? <p className={styles.saved}>{labels.saved(email)}</p> : null}
				<div className={styles.actions}>
					<Button size="large" onClick={() => closeResults("lobby")}>
						{labels.backToLobby}
					</Button>
					<Button
						variant="secondary"
						size="large"
						onClick={() => closeResults("home")}
					>
						{labels.home}
					</Button>
				</div>
			</SelectorGroup>
		</main>
	);
}
