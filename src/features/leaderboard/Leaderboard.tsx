import { TEAM_COLORS, teamStandings } from "@shared/teams";
import type { ReactNode } from "react";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { hudStore, type LeaderboardRow } from "../hud/hudStore";
import styles from "./Leaderboard.module.scss";

export function Leaderboard() {
	const t = useT();
	const labels = t.game.leaderboard;
	const rows = useStore(hudStore, (state) => state.leaderboard);
	return (
		<div className={styles.overlay}>
			<div className={styles.panel}>
				<h2 className={styles.title}>{labels.title}</h2>
				<div className={styles.head}>
					<span>#</span>
					<span>{labels.mushroom}</span>
					<span>{labels.points}</span>
					<span>{labels.health}</span>
					<span>{labels.energy}</span>
				</div>
				{rows.some((row) => row.team !== null)
					? teamStandings(
							rows.map((row) => ({
								playerId: row.id,
								team: row.team,
								score: row.score,
								captures: 0,
								deaths: 0,
							})),
						).map((standing, index) => (
							<div key={standing.team} className={styles.team}>
								<div className={[styles.row, styles.teamHead].join(" ")}>
									<span className={styles.rank}>{index + 1}</span>
									<span className={styles.name}>
										<span
											className={styles.swatch}
											style={{
												background: hexColor(TEAM_COLORS[standing.team]),
											}}
										/>
										{t.common.teams[standing.team]}
									</span>
									<span className={styles.points}>
										{t.common.number(standing.score)}
									</span>
								</div>
								{rows
									.filter((row) => row.team === standing.team)
									.map((row) => (
										<PlayerRow key={row.id} row={row} rank="" />
									))}
							</div>
						))
					: rows.map((row, index) => (
							<PlayerRow key={row.id} row={row} rank={index + 1} />
						))}
			</div>
		</div>
	);
}

function PlayerRow({ row, rank }: { row: LeaderboardRow; rank: ReactNode }) {
	const t = useT();
	const labels = t.game.leaderboard;
	return (
		<div
			className={[
				styles.row,
				row.self ? styles.self : "",
				row.alive ? "" : styles.down,
			].join(" ")}
		>
			<span className={styles.rank}>{rank}</span>
			<span className={styles.name}>
				<span
					className={styles.swatch}
					style={{ background: hexColor(row.color) }}
				/>
				{row.name}
				{row.self ? <em>{labels.you}</em> : null}
				{!row.alive ? <em className={styles.downTag}>{labels.down}</em> : null}
			</span>
			<span className={styles.points}>{t.common.number(row.score)}</span>
			<span className={styles.meter}>
				<span className={styles.health} style={{ width: `${row.health}%` }} />
				<b>{Math.round(row.health)}</b>
			</span>
			<span className={styles.meter}>
				<span className={styles.energy} style={{ width: `${row.energy}%` }} />
				<b>{Math.round(row.energy)}</b>
			</span>
		</div>
	);
}
