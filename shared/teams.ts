export const MAX_TEAM_COUNT = 4;
export const TEAM_COUNT_CHOICES: readonly number[] = [0, 2, 3, MAX_TEAM_COUNT];
export const TEAM_COLORS: readonly number[] = [
	0xe0a43a, 0x3fb8a4, 0xb27ae0, 0xe8e4d8,
];

export interface TeamMember {
	team: number | null;
}

export interface TeamStanding {
	team: number;
	score: number;
	captures: number;
	deaths: number;
	playerIds: string[];
}

export function isTeamCount(value: unknown): value is number {
	return typeof value === "number" && TEAM_COUNT_CHOICES.includes(value);
}

export function smallestTeam(
	members: readonly TeamMember[],
	teamCount: number,
): number {
	const sizes = Array.from({ length: teamCount }, () => 0);
	for (const member of members) {
		if (member.team !== null && member.team < teamCount) {
			sizes[member.team] += 1;
		}
	}
	return sizes.indexOf(Math.min(...sizes));
}

export function sameTeam(a: TeamMember, b: TeamMember): boolean {
	return a.team !== null && a.team === b.team;
}

export function teamStandings(
	entries: readonly {
		playerId: string;
		team: number | null;
		score: number;
		captures: number;
		deaths: number;
	}[],
): TeamStanding[] {
	const teams = new Map<number, TeamStanding>();
	for (const entry of entries) {
		if (entry.team === null) {
			continue;
		}
		const standing = teams.get(entry.team) ?? {
			team: entry.team,
			score: 0,
			captures: 0,
			deaths: 0,
			playerIds: [],
		};
		standing.score += entry.score;
		standing.captures += entry.captures;
		standing.deaths += entry.deaths;
		standing.playerIds.push(entry.playerId);
		teams.set(entry.team, standing);
	}
	return [...teams.values()].sort(
		(a, b) => b.score - a.score || a.deaths - b.deaths || a.team - b.team,
	);
}
