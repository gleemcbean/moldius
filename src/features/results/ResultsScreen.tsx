import { entryWon, newlyCompleted, withMatchMetrics } from "@shared/challenges";
import { DEFAULT_HAT_PATTERN } from "@shared/hatPatterns";
import { matchXp } from "@shared/progression";
import type { MatchResultEntry, MatchResults } from "@shared/protocol/game";
import type { LobbyPlayerInfo } from "@shared/protocol/lobby";
import { accountProgress, newlyUnlocked } from "@shared/rewards";
import { TEAM_COLORS, type TeamStanding } from "@shared/teams";
import { type CSSProperties, useEffect, useRef } from "react";
import { openOverlay } from "../../app/appStore";
import { Button } from "../../components/Button";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { LevelBadge } from "../../components/LevelBadge";
import { SelectorGroup } from "../../components/SelectorGroup";
import { TaglineBadge } from "../../components/TaglineBadge";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { accountStore, refreshAccount } from "../account/accountStore";
import { challengeLabel } from "../challenges/challengeStore";
import { rewardName } from "../challenges/rewardLabels";
import { closeResults } from "../game/matchController";
import { matchStore } from "../game/matchStore";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";
import { LevelProgress, XpBreakdown } from "../profile/LevelProgress";
import { ProfileLink } from "../profile/ProfileLink";
import { PhotoGallery } from "./PhotoGallery";
import styles from "./ResultsScreen.module.scss";

type LobbyLookup = (playerId: string) => LobbyPlayerInfo | undefined;

function reveal(order: number): CSSProperties {
	return { "--reveal": order } as CSSProperties;
}

function placeOf(results: MatchResults, entry: MatchResultEntry): number {
	if (results.teams.length > 0) {
		const team = results.teams.find((standing) => standing.team === entry.team);
		return (
			1 +
			results.teams.filter((other) => other.score > (team?.score ?? 0)).length
		);
	}
	return (
		1 + results.entries.filter((other) => other.score > entry.score).length
	);
}

function PlayerName({
	entry,
	lookup,
}: {
	entry: MatchResultEntry;
	lookup: LobbyLookup;
}) {
	const lobby = lookup(entry.playerId);
	return (
		<span className={styles.name}>
			<ProfileLink
				profileId={lobby?.profileId}
				name={entry.name}
				className={styles.nameText}
			>
				{entry.name}
			</ProfileLink>
			<LevelBadge level={lobby?.level} className={styles.level} />
			<TaglineBadge tagline={entry.tagline} className={styles.tagline} />
		</span>
	);
}

function Podium({
	results,
	lookup,
}: {
	results: MatchResults;
	lookup: LobbyLookup;
}) {
	const t = useT();
	const top = results.entries.slice(0, 3);
	const order = [top[1], top[0], top[2]].filter(
		(entry): entry is MatchResultEntry => entry !== undefined,
	);
	return (
		<ol className={styles.podium} style={reveal(1)}>
			{order.map((entry) => {
				const place = placeOf(results, entry);
				return (
					<li
						key={entry.playerId}
						className={styles.step}
						data-place={Math.min(place, 3)}
						data-selector-row=""
					>
						<span className={styles.stepHat}>
							{place === 1 ? (
								<span className={styles.stepCrown}>
									<Icon name="crown" />
								</span>
							) : null}
							<HatPreview
								color={entry.color}
								pattern={entry.pattern ?? DEFAULT_HAT_PATTERN}
							/>
						</span>
						<PlayerName entry={entry} lookup={lookup} />
						<span className={styles.stepScore}>
							{t.common.points(entry.score)}
						</span>
						<span className={styles.stepBlock}>{place}</span>
					</li>
				);
			})}
		</ol>
	);
}

function TeamBanner({ results }: { results: MatchResults }) {
	const t = useT();
	const labels = t.game.results;
	return (
		<ol className={styles.teams} style={reveal(1)}>
			{results.teams.map((standing, index) => (
				<li
					key={standing.team}
					className={
						standing.team === results.winnerTeam ? styles.teamWon : styles.team
					}
					style={
						{
							"--team": hexColor(TEAM_COLORS[standing.team]),
						} as CSSProperties
					}
				>
					<span className={styles.teamPlace}>{index + 1}</span>
					<span className={styles.teamName}>
						{standing.team === results.winnerTeam ? (
							<Icon name="crown" />
						) : null}
						{t.common.teams[standing.team]}
					</span>
					<span className={styles.teamScore}>
						{t.common.points(standing.score)}
					</span>
					<span className={styles.teamStats}>
						{labels.captures(standing.captures)} ·{" "}
						{labels.deaths(standing.deaths)}
					</span>
				</li>
			))}
		</ol>
	);
}

function Standings({
	results,
	selfId,
	lookup,
}: {
	results: MatchResults;
	selfId: string | null;
	lookup: LobbyLookup;
}) {
	const t = useT();
	const labels = t.game.results;
	const row = (entry: MatchResultEntry, place: number | null) => (
		<li
			key={entry.playerId}
			className={[
				styles.row,
				entry.playerId === selfId ? styles.self : "",
				place === 1 ? styles.first : "",
			].join(" ")}
			data-selector-row=""
		>
			<span className={styles.rank}>{place ?? ""}</span>
			<span className={styles.rowHat}>
				<HatPreview
					color={entry.color}
					pattern={entry.pattern ?? DEFAULT_HAT_PATTERN}
				/>
			</span>
			<PlayerName entry={entry} lookup={lookup} />
			<span className={styles.stat}>{labels.captures(entry.captures)}</span>
			<span className={styles.stat}>{labels.deaths(entry.deaths)}</span>
			<span className={styles.score}>{t.common.points(entry.score)}</span>
		</li>
	);
	const teamHeader = (standing: TeamStanding) => (
		<li
			key={`team-${standing.team}`}
			className={styles.teamHeader}
			style={
				{ "--team": hexColor(TEAM_COLORS[standing.team]) } as CSSProperties
			}
		>
			{t.common.teams[standing.team]}
		</li>
	);
	return (
		<section className={styles.standings} style={reveal(2)}>
			<h2 className={styles.heading}>{labels.standings}</h2>
			<ol className={styles.table}>
				{results.teams.length > 0
					? results.teams.flatMap((standing) => [
							teamHeader(standing),
							...results.entries
								.filter((entry) => entry.team === standing.team)
								.map((entry) => row(entry, null)),
						])
					: results.entries.map((entry) => row(entry, placeOf(results, entry)))}
			</ol>
		</section>
	);
}

function AwardList({
	results,
	selfId,
}: {
	results: MatchResults;
	selfId: string | null;
}) {
	const t = useT();
	const labels = t.game.awards;
	if (results.awards.length === 0) {
		return null;
	}
	return (
		<section className={styles.card} style={reveal(5)}>
			<h2 className={styles.heading}>{labels.title}</h2>
			<ul className={styles.awards}>
				{results.awards.map((award) => {
					const entry = results.entries.find(
						(candidate) => candidate.playerId === award.playerId,
					);
					return (
						<li
							key={award.playerId}
							className={award.playerId === selfId ? styles.awardSelf : ""}
						>
							<strong>{labels.names[award.id]}</strong>
							<span className={styles.awardWho}>
								<i
									className={styles.swatch}
									style={{ background: hexColor(entry?.color ?? 0xffffff) }}
								/>
								{entry?.name ?? "?"}
							</span>
							<em>{labels.details[award.id](Math.round(award.value))}</em>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

export function ResultsScreen() {
	const t = useT();
	const labels = t.game.results;
	const results = useStore(matchStore, (state) => state.results);
	const selfId = useStore(sessionStore, (state) => state.playerId);
	const email = useStore(accountStore, (state) => state.account?.email ?? null);
	const stats = useStore(accountStore, (state) => state.account?.stats ?? null);
	const account = useStore(accountStore, (state) => state.account);
	const progress = account ? accountProgress(account) : null;
	const progressBefore = useRef(progress);
	const lobbyPlayers = useStore(lobbyStore, (state) => state.lobby?.players);
	const selfEntry = results?.entries.find((entry) => entry.playerId === selfId);
	const selfWon = results && selfEntry ? entryWon(results, selfEntry) : false;
	const gained =
		account && selfEntry
			? matchXp({ score: selfEntry.score, won: selfWon })
			: 0;
	const xpBefore = progressBefore.current?.xp ?? 0;
	const afterXp = Math.max(progress?.xp ?? 0, xpBefore + gained);
	const unlocked = newlyUnlocked(
		progressBefore.current,
		progress ? { ...progress, xp: afterXp } : null,
	);
	const challengesBefore = useRef(
		useStore(accountStore, (state) => state.account?.challenges ?? null) ?? {},
	);
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
	const lookup: LobbyLookup = (playerId) =>
		lobbyPlayers?.find((player) => player.id === playerId);
	const winner = results.entries.find(
		(entry) => entry.playerId === results.winnerId,
	);
	const winningTeam = results.teams.find(
		(standing) => standing.team === results.winnerTeam,
	);
	const completed = newlyCompleted(
		challengesBefore.current,
		withMatchMetrics(
			challengesBefore.current,
			(selfId && results.metrics[selfId]) || {},
		),
	);
	const teamMode = results.teams.length > 0;
	const placeCount = teamMode ? results.teams.length : results.entries.length;
	const minutes = Math.max(1, Math.round(results.durationMs / 60_000));
	const hasNews = completed.length > 0 || unlocked.length > 0;
	return (
		<main className={styles.results}>
			<SelectorGroup className={styles.layout}>
				<header className={styles.header} style={reveal(0)}>
					<div>
						<p className={styles.kicker}>
							<span>{labels.kicker}</span>
							<span className={styles.kickerMuted}>
								{labels.duration(minutes)} ·{" "}
								{labels.players(results.entries.length)}
							</span>
						</p>
						<h1 className={styles.title}>{labels.title}</h1>
					</div>
					<p className={styles.winner}>
						{winningTeam || winner ? <Icon name="crown" /> : null}
						<span>
							{winningTeam
								? labels.teamWinner(
										t.common.teams[winningTeam.team],
										t.common.number(winningTeam.score),
									)
								: winner
									? labels.winner(winner.name, t.common.number(winner.score))
									: labels.noWinner}
						</span>
					</p>
				</header>

				<div className={styles.columns}>
					<div className={styles.main}>
						{teamMode ? (
							<TeamBanner results={results} />
						) : results.entries.length > 1 ? (
							<Podium results={results} lookup={lookup} />
						) : null}
						<Standings results={results} selfId={selfId} lookup={lookup} />
					</div>

					<aside className={styles.side}>
						{selfEntry ? (
							<section
								className={[styles.card, selfWon ? styles.cardWon : ""].join(
									" ",
								)}
								style={reveal(3)}
							>
								<h2 className={styles.heading}>{labels.yourGame}</h2>
								<dl className={styles.facts}>
									<div>
										<dt>{labels.place}</dt>
										<dd>
											{placeOf(results, selfEntry)}
											<small>/{placeCount}</small>
										</dd>
									</div>
									<div>
										<dt>{labels.score}</dt>
										<dd>{t.common.number(selfEntry.score)}</dd>
									</div>
									<div>
										<dt>{labels.capturesLabel}</dt>
										<dd>{selfEntry.captures}</dd>
									</div>
									<div>
										<dt>{labels.deathsLabel}</dt>
										<dd>{selfEntry.deaths}</dd>
									</div>
								</dl>
								<div className={styles.xp}>
									{account ? (
										<>
											<LevelProgress xp={afterXp} gained={afterXp - xpBefore} />
											<XpBreakdown score={selfEntry.score} won={selfWon} />
										</>
									) : (
										<p className={styles.note}>{t.progression.signInForXp}</p>
									)}
								</div>
							</section>
						) : null}

						{hasNews ? (
							<section
								className={[styles.card, styles.news].join(" ")}
								style={reveal(4)}
							>
								<h2 className={styles.heading}>{labels.unlocksTitle}</h2>
								<ul className={styles.newsList}>
									{completed.map((item) => (
										<li key={`challenge-${item.id}-${item.tier ?? 0}`}>
											<span className={styles.newsTag}>
												{labels.challengeTag}
											</span>
											{challengeLabel(t, item)}
										</li>
									))}
									{unlocked.map((reward) => (
										<li key={`reward-${reward.kind}-${reward.value}`}>
											<span className={styles.newsTag}>{labels.rewardTag}</span>
											{rewardName(t, reward)}
										</li>
									))}
								</ul>
							</section>
						) : null}

						<AwardList results={results} selfId={selfId} />
						<PhotoGallery />
					</aside>
				</div>

				<footer className={styles.footer} style={reveal(6)}>
					<div className={styles.notes}>
						{results.daily ? (
							<p className={styles.note}>
								{stats ? t.daily.saved : t.daily.signInHint}{" "}
								<button
									type="button"
									className={styles.link}
									onClick={() => openOverlay("daily")}
									data-selectable=""
								>
									{t.daily.seeBoard}
								</button>
							</p>
						) : null}
						{email ? (
							<p className={styles.note}>{labels.saved(email)}</p>
						) : null}
					</div>
					<div className={styles.actions}>
						<Button
							variant="secondary"
							size="large"
							onClick={() => closeResults("home")}
						>
							{labels.home}
						</Button>
						<Button size="large" onClick={() => closeResults("lobby")}>
							{labels.backToLobby}
						</Button>
					</div>
				</footer>
			</SelectorGroup>
		</main>
	);
}
