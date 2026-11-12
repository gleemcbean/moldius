import { colorHex } from "@shared/playerColors";
import type { AdminOverview, AdminPlayer } from "@shared/protocol/admin";
import {
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import styles from "./AdminPage.module.scss";

const REFRESH_MS = 30_000;
const WEEKDAYS = [
	"Lundi",
	"Mardi",
	"Mercredi",
	"Jeudi",
	"Vendredi",
	"Samedi",
	"Dimanche",
];
const HEAT_STEPS = [
	"#104281",
	"#184f95",
	"#256abf",
	"#3987e5",
	"#6da7ec",
	"#9ec5f4",
	"#cde2fb",
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function hourLabel(hour: number): string {
	return `${hour} h`;
}

function formatDuration(ms: number | null): string {
	if (ms === null) {
		return "—";
	}
	const minutes = Math.round(ms / 60_000);
	if (minutes < 60) {
		return `${minutes} min`;
	}
	return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

function formatAgo(value: string | null, now: number): string {
	if (!value) {
		return "—";
	}
	const seconds = (new Date(value).getTime() - now) / 1000;
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		["day", 86_400],
		["hour", 3600],
		["minute", 60],
	];
	for (const [unit, size] of units) {
		if (Math.abs(seconds) >= size) {
			return relative.format(Math.round(seconds / size), unit);
		}
	}
	return "à l'instant";
}

interface TooltipState {
	x: number;
	y: number;
	text: ReactNode;
}

function useTooltip() {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null);
	const bind = (text: ReactNode) => ({
		onMouseMove: (event: ReactMouseEvent) =>
			setTooltip({ x: event.clientX, y: event.clientY, text }),
		onMouseLeave: () => setTooltip(null),
	});
	const node = tooltip ? (
		<div
			className={styles.tooltip}
			style={{
				left: Math.min(tooltip.x + 14, window.innerWidth - 240),
				top: tooltip.y + 14,
			}}
		>
			{tooltip.text}
		</div>
	) : null;
	return { bind, node };
}

function Tile({
	label,
	value,
	note,
}: {
	label: string;
	value: string;
	note?: string;
}) {
	return (
		<div className={styles.tile}>
			<span className={styles.tileLabel}>{label}</span>
			<strong className={styles.tileValue}>{value}</strong>
			{note ? <span className={styles.tileNote}>{note}</span> : null}
		</div>
	);
}

function niceMax(value: number): number {
	if (value <= 4) {
		return 4;
	}
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= value) ?? 10;
	return step * magnitude;
}

interface ColumnDatum {
	key: string;
	label: string;
	value: number;
	tooltip: ReactNode;
}

function ColumnChart({
	data,
	labelEvery,
	bind,
	description,
}: {
	data: ColumnDatum[];
	labelEvery: number;
	bind: ReturnType<typeof useTooltip>["bind"];
	description: string;
}) {
	const highest = Math.max(0, ...data.map((datum) => datum.value));
	const top = niceMax(highest);
	const highestIndex = data.findIndex(
		(datum) => datum.value === highest && highest > 0,
	);
	return (
		<div className={styles.columns} role="img" aria-label={description}>
			<div className={styles.columnAxis}>
				<span>{number.format(top)}</span>
				<span>{number.format(top / 2)}</span>
				<span>0</span>
			</div>
			<div className={styles.columnPlot}>
				<i className={styles.gridTop} />
				<i className={styles.gridMid} />
				{data.map((datum, index) => (
					<div
						className={styles.columnHit}
						key={datum.key}
						{...bind(datum.tooltip)}
					>
						<div className={styles.columnArea}>
							<div
								className={styles.columnBar}
								style={{ height: `${(datum.value / top) * 100}%` }}
							>
								{index === highestIndex ? (
									<span className={styles.columnPeak}>
										{number.format(datum.value)}
									</span>
								) : null}
							</div>
						</div>
						<span className={styles.columnLabel}>
							{index % labelEvery === 0 ? datum.label : ""}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function Heatmap({
	heatmap,
	bind,
}: {
	heatmap: (number | null)[][];
	bind: ReturnType<typeof useTooltip>["bind"];
}) {
	const highest = Math.max(0, ...heatmap.flat().map((value) => value ?? 0));
	const colorOf = (value: number) => {
		const ratio = highest > 0 ? value / highest : 0;
		return HEAT_STEPS[
			Math.min(HEAT_STEPS.length - 1, Math.floor(ratio * HEAT_STEPS.length))
		];
	};
	return (
		<div>
			<div
				className={styles.heatmap}
				role="img"
				aria-label="Moyenne de personnes connectées par jour de la semaine et par heure"
			>
				<span />
				{HOURS.map((hour) => (
					<span className={styles.heatHour} key={hour}>
						{hour % 3 === 0 ? hour : ""}
					</span>
				))}
				{heatmap.map((row, weekday) => (
					<div className={styles.heatRow} key={WEEKDAYS[weekday]}>
						<span className={styles.heatDay}>
							{WEEKDAYS[weekday].slice(0, 3)}
						</span>
						{HOURS.map((hour) => {
							const value = row[hour];
							return (
								<div
									key={hour}
									className={styles.heatCell}
									style={
										value !== null ? { background: colorOf(value) } : undefined
									}
									{...bind(
										<>
											<strong>
												{WEEKDAYS[weekday]}, {hourLabel(hour)}
											</strong>
											<br />
											{value === null
												? "Aucun relevé"
												: `${number.format(value)} connecté(s) en moyenne`}
										</>,
									)}
								/>
							);
						})}
					</div>
				))}
			</div>
			<div className={styles.heatLegend}>
				<span>0</span>
				<div className={styles.heatScale}>
					{HEAT_STEPS.map((color) => (
						<i key={color} style={{ background: color }} />
					))}
				</div>
				<span>{number.format(highest)} en moyenne</span>
				<i className={styles.heatEmpty} />
				<span>aucun relevé</span>
			</div>
		</div>
	);
}

function DataTable({
	summary,
	head,
	rows,
}: {
	summary: string;
	head: string[];
	rows: (string | number)[][];
}) {
	return (
		<details className={styles.dataTable}>
			<summary>{summary}</summary>
			<div className={styles.tableScroll}>
				<table>
					<thead>
						<tr>
							{head.map((cell) => (
								<th key={cell}>{cell}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={String(row[0])}>
								{row.map((cell, index) => (
									<td key={index}>{cell}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	);
}

type SortKey =
	| "name"
	| "createdAt"
	| "lastMatchAt"
	| "lastSeenAt"
	| "gamesPlayed"
	| "wins"
	| "bestScore"
	| "totalScore"
	| "playtimeMs"
	| "friends";

const LOGIN_LABEL = { email: "E-mail", discord: "Discord", both: "Les deux" };

function PlayersTable({
	players,
	now,
	timeZone,
}: {
	players: AdminPlayer[];
	now: number;
	timeZone: string;
}) {
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
		key: "lastSeenAt",
		descending: true,
	});
	const fullDate = useMemo(
		() =>
			new Intl.DateTimeFormat("fr-FR", {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone,
			}),
		[timeZone],
	);
	const visible = useMemo(() => {
		const search = query.trim().toLowerCase();
		const filtered = search
			? players.filter((player) => player.name.toLowerCase().includes(search))
			: players;
		const direction = sort.descending ? -1 : 1;
		return [...filtered].sort((a, b) => {
			const left = a[sort.key];
			const right = b[sort.key];
			if (left === right) {
				return 0;
			}
			if (left === null) {
				return 1;
			}
			if (right === null) {
				return -1;
			}
			return (
				(typeof left === "number" && typeof right === "number"
					? left - right
					: String(left).localeCompare(String(right))) * direction
			);
		});
	}, [players, query, sort]);
	const header = (key: SortKey, label: string, numeric = false) => (
		<th
			className={numeric ? styles.numeric : undefined}
			aria-sort={
				sort.key === key
					? sort.descending
						? "descending"
						: "ascending"
					: undefined
			}
		>
			<button
				type="button"
				onClick={() =>
					setSort((current) => ({
						key,
						descending:
							current.key === key ? !current.descending : key !== "name",
					}))
				}
			>
				{label}
				{sort.key === key ? (sort.descending ? " ▾" : " ▴") : ""}
			</button>
		</th>
	);
	const dated = (value: string | null) => (
		<td title={value ? fullDate.format(new Date(value)) : undefined}>
			{formatAgo(value, now)}
		</td>
	);
	return (
		<>
			<input
				className={styles.search}
				type="search"
				placeholder="Chercher un pseudo…"
				aria-label="Chercher un pseudo"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
			<div className={styles.tableScroll}>
				<table className={styles.players}>
					<thead>
						<tr>
							{header("name", "Pseudo")}
							{header("createdAt", "Inscription")}
							{header("lastMatchAt", "Dernière partie")}
							{header("lastSeenAt", "Dernière visite")}
							{header("gamesPlayed", "Parties", true)}
							{header("wins", "Victoires", true)}
							{header("bestScore", "Meilleur score", true)}
							{header("totalScore", "Score total", true)}
							{header("playtimeMs", "Temps de jeu", true)}
							{header("friends", "Amis", true)}
							<th>Connexion</th>
						</tr>
					</thead>
					<tbody>
						{visible.map((player) => (
							<tr key={player.id}>
								<td className={styles.playerName}>
									<i
										className={styles.hatDot}
										style={{ background: `#${colorHex(player.color)}` }}
										aria-hidden="true"
									/>
									{player.name}
									{player.online ? (
										<span className={styles.onlineTag}>en ligne</span>
									) : null}
								</td>
								{dated(player.createdAt)}
								{dated(player.lastMatchAt)}
								{dated(player.lastSeenAt ?? player.lastLoginAt)}
								<td className={styles.numeric}>{player.gamesPlayed}</td>
								<td className={styles.numeric}>{player.wins}</td>
								<td className={styles.numeric}>{player.bestScore}</td>
								<td className={styles.numeric}>{player.totalScore}</td>
								<td className={styles.numeric}>
									{formatDuration(player.playtimeMs)}
								</td>
								<td className={styles.numeric}>{player.friends}</td>
								<td>
									{LOGIN_LABEL[player.login]}
									{player.verified ? "" : " (non vérifié)"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{visible.length === 0 ? (
					<p className={styles.note}>Aucun joueur ne correspond.</p>
				) : null}
			</div>
		</>
	);
}

function Dashboard({
	data,
	onRefresh,
}: {
	data: AdminOverview;
	onRefresh: () => void;
}) {
	const { bind, node } = useTooltip();
	const { live, totals, presence, daily, timeZone } = data;
	const now = new Date(data.generatedAt).getTime();
	const dateTime = new Intl.DateTimeFormat("fr-FR", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone,
	});
	const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
	const hasSamples = presence.samples > 0;
	return (
		<main className={styles.page}>
			<div className={styles.content}>
				<header className={styles.header}>
					<div>
						<h1>Panel admin</h1>
						<p className={styles.note}>
							Mis à jour le {dateTime.format(now)} · heures de Paris
						</p>
					</div>
					<button type="button" className={styles.refresh} onClick={onRefresh}>
						Actualiser
					</button>
				</header>

				<section className={styles.liveRow}>
					<div className={styles.hero}>
						<span className={styles.tileLabel}>Connectés maintenant</span>
						<strong className={styles.heroValue}>{live.connected}</strong>
						<span className={styles.tileNote}>
							dont {live.signedIn} avec un compte
						</span>
					</div>
					<Tile label="Dans un lobby" value={String(live.inLobby)} />
					<Tile label="En partie" value={String(live.inMatch)} />
					<Tile
						label="Lobbys / parties ouverts"
						value={`${live.lobbies} / ${live.matches}`}
					/>
				</section>

				<section className={styles.tiles}>
					<Tile
						label="Inscrits"
						value={String(totals.accounts)}
						note={`+${totals.new24h} en 24 h · +${totals.new7d} en 7 j · +${totals.new30d} en 30 j`}
					/>
					<Tile
						label="Actifs"
						value={`${totals.active7d} / ${totals.active30d}`}
						note="sur 7 jours / 30 jours"
					/>
					<Tile
						label="E-mails vérifiés"
						value={String(totals.verified)}
						note={`${totals.discord} compte(s) Discord`}
					/>
					<Tile
						label="Parties"
						value={String(totals.matches)}
						note={`dont ${totals.matches30d} sur 30 jours`}
					/>
					<Tile
						label="Durée moyenne"
						value={formatDuration(totals.averageDurationMs)}
						note="sur 30 jours"
					/>
					<Tile
						label="Joueurs par partie"
						value={
							totals.averagePlayers === null
								? "—"
								: number.format(totals.averagePlayers)
						}
						note="sur 30 jours"
					/>
					<Tile label="Amitiés" value={String(totals.friendships)} />
				</section>

				<section className={styles.card}>
					<h2>Horaires d'affluence</h2>
					{hasSamples ? (
						<p className={styles.headline}>
							{presence.bestSlot ? (
								<>
									Meilleur créneau :{" "}
									<strong>
										{WEEKDAYS[presence.bestSlot.weekday].toLowerCase()} à{" "}
										{hourLabel(presence.bestSlot.hour)}
									</strong>{" "}
									({number.format(presence.bestSlot.average)} connectés en
									moyenne).{" "}
								</>
							) : null}
							{presence.peak ? (
								<>
									Pic : <strong>{presence.peak.connected}</strong> le{" "}
									{dateTime.format(new Date(presence.peak.at))}.
								</>
							) : null}
						</p>
					) : (
						<p className={styles.headline}>
							Pas encore de relevé. Le serveur compte les connectés toutes les 5
							minutes : les graphiques se remplissent à partir de maintenant.
						</p>
					)}
					<h3>Connectés en moyenne par heure</h3>
					<ColumnChart
						data={presence.byHour.map((entry) => ({
							key: String(entry.hour),
							label: String(entry.hour),
							value: entry.average,
							tooltip: (
								<>
									<strong>{hourLabel(entry.hour)}</strong>
									<br />
									Moyenne : {number.format(entry.average)}
									<br />
									Pic : {entry.peak}
								</>
							),
						}))}
						labelEvery={3}
						bind={bind}
						description="Moyenne de personnes connectées pour chaque heure de la journée"
					/>
					<h3>Par jour de la semaine et par heure</h3>
					<Heatmap heatmap={presence.heatmap} bind={bind} />
					<p className={styles.note}>
						{presence.samples} relevé(s) sur {presence.days} jours, invités
						compris.
					</p>
					<DataTable
						summary="Voir les données"
						head={[
							"Heure",
							"Moyenne",
							"Pic",
							...WEEKDAYS.map((day) => day.slice(0, 3)),
						]}
						rows={presence.byHour.map((entry) => [
							hourLabel(entry.hour),
							number.format(entry.average),
							entry.peak,
							...presence.heatmap.map((row) =>
								row[entry.hour] === null
									? "—"
									: number.format(row[entry.hour] as number),
							),
						])}
					/>
				</section>

				<section className={styles.card}>
					<h2>30 derniers jours</h2>
					<div className={styles.smallMultiples}>
						<div>
							<h3>Parties par jour</h3>
							<ColumnChart
								data={daily.map((day) => ({
									key: day.date,
									label: dayLabel(day.date),
									value: day.matches,
									tooltip: (
										<>
											<strong>{dayLabel(day.date)}</strong>
											<br />
											{day.matches} partie(s)
										</>
									),
								}))}
								labelEvery={7}
								bind={bind}
								description="Nombre de parties par jour sur 30 jours"
							/>
						</div>
						<div>
							<h3>Inscriptions par jour</h3>
							<ColumnChart
								data={daily.map((day) => ({
									key: day.date,
									label: dayLabel(day.date),
									value: day.registrations,
									tooltip: (
										<>
											<strong>{dayLabel(day.date)}</strong>
											<br />
											{day.registrations} inscription(s)
										</>
									),
								}))}
								labelEvery={7}
								bind={bind}
								description="Nombre d'inscriptions par jour sur 30 jours"
							/>
						</div>
					</div>
					<p className={styles.note}>
						Seules les parties jouées par au moins un joueur avec compte sont
						enregistrées.
					</p>
					<DataTable
						summary="Voir les données"
						head={["Jour", "Parties", "Inscriptions"]}
						rows={daily.map((day) => [
							dayLabel(day.date),
							day.matches,
							day.registrations,
						])}
					/>
				</section>

				<section className={styles.card}>
					<h2>Joueurs inscrits ({data.players.length})</h2>
					<PlayersTable players={data.players} now={now} timeZone={timeZone} />
				</section>
			</div>
			{node}
		</main>
	);
}

export function AdminPage() {
	const [state, setState] = useState<
		| { kind: "loading" }
		| { kind: "error" }
		| { kind: "ready"; data: AdminOverview }
	>({ kind: "loading" });

	const load = useCallback(async () => {
		try {
			const response = await fetch("/api/admin/overview", {
				credentials: "same-origin",
			});
			if (response.status === 404) {
				window.location.replace("/");
			} else if (response.ok) {
				setState({
					kind: "ready",
					data: (await response.json()) as AdminOverview,
				});
			} else {
				setState((current) =>
					current.kind === "ready" ? current : { kind: "error" },
				);
			}
		} catch {
			setState((current) =>
				current.kind === "ready" ? current : { kind: "error" },
			);
		}
	}, []);

	useEffect(() => {
		document.title = "MOLDIUS";
		void load();
		const timer = window.setInterval(() => void load(), REFRESH_MS);
		return () => window.clearInterval(timer);
	}, [load]);

	if (state.kind === "ready") {
		return <Dashboard data={state.data} onRefresh={() => void load()} />;
	}
	return (
		<main className={styles.page}>
			<div className={styles.centered}>
				{state.kind === "error" ? <p>Serveur injoignable.</p> : null}
			</div>
		</main>
	);
}
