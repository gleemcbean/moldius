import { CHALLENGE_METRICS, type ChallengeMetric } from "@shared/challenges";
import { dailyChallenge } from "@shared/dailyChallenge";
import {
	MATCH_HISTORY_LIMIT,
	type MatchDetail,
	type MatchDetailPlayer,
	type MatchHistoryEntry,
} from "@shared/protocol/account";
import { TEAM_COLORS } from "@shared/teams";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { TaglineBadge } from "../../components/TaglineBadge";
import { type Messages, useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import styles from "./AccountModal.module.scss";
import { loadHistory, loadHistoryDetail } from "./accountStore";
import detail from "./MatchHistory.module.scss";

type HistoryLabels = Messages["account"]["history"];

/** Les mesures montrées dans « Vos chiffres », dans cet ordre. */
const SHOWN_METRICS = CHALLENGE_METRICS.filter(
	(
		metric,
	): metric is Exclude<
		ChallengeMetric,
		"games" | "wins" | "flawless" | "flawlessWins" | "dailies" | "captures"
	> =>
		![
			"games",
			"wins",
			"flawless",
			"flawlessWins",
			"dailies",
			"captures",
		].includes(metric),
);

function modeLabel(t: Messages, entry: MatchHistoryEntry): string {
	const labels = t.account.history;
	if (entry.daily) {
		const { theme } = dailyChallenge(entry.daily);
		return labels.daily(t.daily.themes[theme].name);
	}
	return entry.visibility === "private" ? labels.private : labels.public;
}

/** En équipes, la place est celle de l'équipe : « 1er sur 4 » serait faux à deux équipes. */
function placeLabel(labels: HistoryLabels, entry: MatchHistoryEntry): string {
	const rank = labels.rankLabel(entry.rank);
	return entry.teamCount > 0
		? labels.teamPlace(rank, entry.teamCount)
		: labels.place(rank, entry.playerCount);
}

function minutes(durationMs: number): number {
	return Math.max(1, Math.round(durationMs / 60_000));
}

export function HistoryPanel() {
	const t = useT();
	const labels = t.account.history;
	const [entries, setEntries] = useState<MatchHistoryEntry[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [openId, setOpenId] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		void loadHistory().then((result) => {
			if (!active) {
				return;
			}
			if (result.ok) {
				setEntries(result.value);
			} else {
				setError(result.error);
			}
		});
		return () => {
			active = false;
		};
	}, []);

	if (error) {
		return <p className={styles.error}>{error}</p>;
	}
	if (!entries) {
		return <p className={styles.note}>{labels.loading}</p>;
	}
	if (entries.length === 0) {
		return <p className={styles.empty}>{labels.empty}</p>;
	}
	const opened = entries.find((entry) => entry.matchId === openId);
	if (opened) {
		return <MatchDetailView entry={opened} onBack={() => setOpenId(null)} />;
	}
	return (
		<div className={styles.historyWrap}>
			<table className={[styles.history, detail.list].join(" ")}>
				<thead>
					<tr>
						<th>{labels.date}</th>
						<th>{labels.match}</th>
						<th>{labels.duration}</th>
						<th>{labels.rank}</th>
						<th className={styles.number}>{labels.points}</th>
						<th className={styles.number}>{labels.captures}</th>
						<th className={styles.number}>{labels.deaths}</th>
						<th>
							<span className={detail.visuallyHidden}>{labels.open}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{entries.map((entry) => (
						<tr
							key={entry.matchId}
							className={[
								entry.won ? styles.won : "",
								entry.hasDetails ? detail.clickable : "",
							].join(" ")}
							onClick={
								entry.hasDetails ? () => setOpenId(entry.matchId) : undefined
							}
						>
							<td>{labels.dateTime(new Date(entry.playedAt))}</td>
							<td>{modeLabel(t, entry)}</td>
							<td>{labels.minutes(minutes(entry.durationMs))}</td>
							<td>
								<span className={styles.rank}>
									{entry.won ? <Icon name="crown" /> : null}
									{placeLabel(labels, entry)}
								</span>
							</td>
							<td className={styles.number}>{t.common.number(entry.score)}</td>
							<td className={styles.number}>{entry.captures}</td>
							<td className={styles.number}>{entry.deaths}</td>
							<td className={detail.openCell}>
								{entry.hasDetails ? (
									<button
										type="button"
										className={detail.openButton}
										aria-label={labels.open}
										title={labels.open}
										onClick={(event) => {
											event.stopPropagation();
											setOpenId(entry.matchId);
										}}
										data-selectable=""
									>
										›
									</button>
								) : (
									<span className={detail.noDetails} title={labels.noDetails}>
										–
									</span>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<p className={styles.note}>{labels.limit(MATCH_HISTORY_LIMIT)}</p>
		</div>
	);
}

function MatchDetailView({
	entry,
	onBack,
}: {
	entry: MatchHistoryEntry;
	onBack: () => void;
}) {
	const t = useT();
	const labels = t.account.history;
	const [match, setMatch] = useState<MatchDetail | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		void loadHistoryDetail(entry.matchId).then((result) => {
			if (!active) {
				return;
			}
			if (result.ok) {
				setMatch(result.value);
			} else {
				setError(result.error);
			}
		});
		return () => {
			active = false;
		};
	}, [entry.matchId]);

	return (
		<div className={detail.detail}>
			<div className={detail.toolbar}>
				<Button variant="secondary" onClick={onBack}>
					← {labels.back}
				</Button>
			</div>
			<header className={detail.header}>
				<p className={detail.kicker}>
					{modeLabel(t, entry)} · {labels.dateTime(new Date(entry.playedAt))}
				</p>
				<h3 className={entry.won ? detail.titleWon : detail.title}>
					{entry.won ? <Icon name="crown" /> : null}
					{entry.won
						? labels.won
						: labels.yourResult(placeLabel(labels, entry))}
				</h3>
				<dl className={detail.facts}>
					<Fact label={labels.points} value={t.common.number(entry.score)} />
					<Fact label={labels.captures} value={String(entry.captures)} />
					<Fact label={labels.deaths} value={String(entry.deaths)} />
					<Fact
						label={labels.duration}
						value={labels.minutes(minutes(entry.durationMs))}
					/>
				</dl>
			</header>
			{error ? <p className={styles.error}>{error}</p> : null}
			{!match && !error ? (
				<p className={styles.note}>{labels.loading}</p>
			) : null}
			{match ? <MatchDetailBody match={match} /> : null}
		</div>
	);
}

function Fact({ label, value }: { label: string; value: string }) {
	return (
		<div className={detail.fact}>
			<dt>{label}</dt>
			<dd>{value}</dd>
		</div>
	);
}

function MatchDetailBody({ match }: { match: MatchDetail }) {
	const t = useT();
	const labels = t.account.history;
	const rules = match.rules;
	const awards = match.players.flatMap((player) =>
		player.awards.map((award) => ({ player, award })),
	);
	const numbers = SHOWN_METRICS.flatMap((metric) => {
		const value = match.metrics[metric] ?? 0;
		return value > 0
			? [labels.metrics[metric](t.common.number(Math.round(value)))]
			: [];
	});
	return (
		<>
			<section className={detail.section}>
				<h4>{labels.standings}</h4>
				<Standings match={match} />
			</section>
			<div className={detail.columns}>
				<section className={detail.section}>
					<h4>{labels.yourNumbers}</h4>
					{numbers.length > 0 ? (
						<ul className={detail.numbers}>
							{numbers.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ul>
					) : (
						<p className={styles.note}>{labels.noNumbers}</p>
					)}
				</section>
				<section className={detail.section}>
					<h4>{labels.awards}</h4>
					{awards.length > 0 ? (
						<ul className={detail.awards}>
							{awards.map(({ player, award }) => (
								<li
									key={`${player.name}-${award.id}`}
									className={player.self ? detail.self : ""}
								>
									<span
										className={styles.dot}
										style={{ background: hexColor(player.color) }}
									/>
									<span className={detail.awardName}>{player.name}</span>
									<strong>{t.game.awards.names[award.id]}</strong>
									<em>{t.game.awards.details[award.id](award.value)}</em>
								</li>
							))}
						</ul>
					) : (
						<p className={styles.note}>{labels.noAwards}</p>
					)}
				</section>
			</div>
			{rules ? (
				<section className={detail.section}>
					<h4>{labels.rules}</h4>
					<p className={detail.rules}>
						{[
							labels.rulesSummary(
								t.world.manorSizes[rules.manorSize],
								rules.floors,
								rules.anomalies,
							),
							labels.minutes(rules.durationMinutes),
							rules.teamCount > 0 ? labels.teams(rules.teamCount) : null,
							rules.walkies ? labels.walkies : null,
						]
							.filter(Boolean)
							.join(" · ")}
					</p>
				</section>
			) : null}
		</>
	);
}

function Standings({ match }: { match: MatchDetail }) {
	const t = useT();
	const labels = t.account.history;
	const rank = (player: MatchDetailPlayer) =>
		1 + match.players.filter((other) => other.score > player.score).length;
	const playerRow = (player: MatchDetailPlayer, shownRank: number | null) => (
		<tr
			key={`${player.name}-${player.color}`}
			className={[
				player.self ? detail.self : "",
				shownRank === null ? detail.member : "",
			].join(" ")}
		>
			<td className={detail.rankCell}>{shownRank}</td>
			<td>
				<span className={detail.who}>
					<span className={detail.hat}>
						<HatPreview color={player.color} pattern={player.pattern} />
					</span>
					<span className={detail.whoName}>
						{player.name}
						<TaglineBadge tagline={player.tagline} />
					</span>
				</span>
			</td>
			<td className={styles.number}>{player.captures}</td>
			<td className={styles.number}>{player.deaths}</td>
			<td className={[styles.number, detail.score].join(" ")}>
				{t.common.number(player.score)}
			</td>
		</tr>
	);
	return (
		<table className={[styles.history, detail.standings].join(" ")}>
			<thead>
				<tr>
					<th className={detail.rankCell}>#</th>
					<th>{match.teams.length > 0 ? labels.team : labels.player}</th>
					<th className={styles.number}>{labels.captures}</th>
					<th className={styles.number}>{labels.deaths}</th>
					<th className={styles.number}>{labels.points}</th>
				</tr>
			</thead>
			<tbody>
				{match.teams.length > 0
					? match.teams.flatMap((team, index) => [
							<tr
								key={`team-${team.team}`}
								className={[
									detail.teamRow,
									team.team === match.winnerTeam ? styles.won : "",
								].join(" ")}
							>
								<td className={detail.rankCell}>{index + 1}</td>
								<td>
									<span className={detail.who}>
										<span
											className={styles.dot}
											style={{ background: hexColor(TEAM_COLORS[team.team]) }}
										/>
										{t.common.teams[team.team]}
										{team.team === match.winnerTeam ? (
											<Icon name="crown" className={detail.crown} />
										) : null}
									</span>
								</td>
								<td className={styles.number}>{team.captures}</td>
								<td className={styles.number}>{team.deaths}</td>
								<td className={[styles.number, detail.score].join(" ")}>
									{t.common.number(team.score)}
								</td>
							</tr>,
							...match.players
								.filter((player) => player.team === team.team)
								.map((player) => playerRow(player, null)),
						])
					: match.players.map((player) => playerRow(player, rank(player)))}
			</tbody>
		</table>
	);
}
