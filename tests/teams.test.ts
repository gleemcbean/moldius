import { describe, expect, it } from "vitest";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { Lobby } from "../server/lobby/Lobby.js";
import { MATCH_DURATION_MS } from "../shared/config/index.js";
import {
	defaultPrivateConfig,
	sanitizeMatchConfig,
} from "../shared/matchConfig.js";
import { yawToDirection } from "../shared/math.js";
import type { MatchResults } from "../shared/protocol/game.js";
import { MAX_TEAM_COUNT, TEAM_COLORS } from "../shared/teams.js";
import {
	findClearLine,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function privateLobby(players: number): Lobby {
	const lobby = new Lobby("l_test", "private", "CODE", 1);
	for (let index = 0; index < players; index += 1) {
		lobby.add(`p${index + 1}`, `Joueur ${index + 1}`, index);
	}
	return lobby;
}

function teamsOf(lobby: Lobby): (number | null)[] {
	return lobby.toState().players.map((player) => player.team);
}

describe("mode équipes", () => {
	it("n'accepte que 0, 2, 3 ou 4 équipes", () => {
		const fallback = defaultPrivateConfig();
		expect(fallback.teamCount).toBe(0);
		for (const [input, expected] of [
			[2, 2],
			[3, 3],
			[0, 0],
			[4, 4],
			[1, 0],
			[5, 0],
			["2", 0],
		] as const) {
			expect(
				sanitizeMatchConfig({ ...fallback, teamCount: input }, fallback)
					.teamCount,
			).toBe(expected);
		}
	});

	it("répartit les joueurs équitablement et place les nouveaux venus dans la plus petite équipe", () => {
		const lobby = privateLobby(3);
		expect(teamsOf(lobby)).toEqual([null, null, null]);
		lobby.updateConfig("p1", { ...lobby.config, teamCount: 2 });
		expect(teamsOf(lobby)).toEqual([0, 1, 0]);
		lobby.add("p4", "Joueur 4", 10);
		expect(teamsOf(lobby)).toEqual([0, 1, 0, 1]);
		lobby.updateConfig("p1", { ...lobby.config, teamCount: 3 });
		expect(teamsOf(lobby)).toEqual([0, 1, 0, 1]);
		expect(lobby.setTeam("p3", 2).ok).toBe(true);
		lobby.updateConfig("p1", { ...lobby.config, teamCount: 2 });
		expect(teamsOf(lobby)).toEqual([0, 1, 0, 1]);
		lobby.updateConfig("p1", { ...lobby.config, teamCount: 0 });
		expect(teamsOf(lobby)).toEqual([null, null, null, null]);
	});

	it("répartit 8 joueurs en 4 équipes de 2", () => {
		const lobby = privateLobby(8);
		lobby.updateConfig("p1", { ...lobby.config, teamCount: 4 });
		expect(teamsOf(lobby)).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
		expect(lobby.setTeam("p1", 3).ok).toBe(true);
		expect(lobby.setTeam("p1", 4).ok).toBe(false);
		expect(TEAM_COLORS).toHaveLength(MAX_TEAM_COUNT);
	});

	it("laisse chacun choisir une équipe existante, seulement en attente", () => {
		const lobby = privateLobby(2);
		expect(lobby.setTeam("p2", 0).ok).toBe(false);
		lobby.updateConfig("p1", { ...lobby.config, teamCount: 2 });
		expect(lobby.setTeam("p2", 0).ok).toBe(true);
		expect(teamsOf(lobby)).toEqual([0, 0]);
		expect(lobby.setTeam("p2", 2).ok).toBe(false);
		expect(lobby.setTeam("p2", -1).ok).toBe(false);
		lobby.phase = "playing";
		expect(lobby.setTeam("p2", 1).ok).toBe(false);
	});

	it("additionne les points de chaque équipe et désigne l'équipe gagnante", () => {
		const sim = new MatchSimulation({
			seed: 5,
			players: 3,
			config: { teamCount: 2 },
			teams: [0, 1, 1],
		});
		silenceAnomalies(sim);
		const [p1, p2, p3] = ["p1", "p2", "p3"].map(
			(id) => sim.match.players.get(id) as MatchPlayer,
		);
		p1.score = 500;
		p2.score = 300;
		p3.score = 250;
		sim.run(MATCH_DURATION_MS / 1000 + 1);
		const results = sim.results as MatchResults;
		expect(results.winnerId).toBeNull();
		expect(results.winnerTeam).toBe(1);
		expect(
			results.teams.map((team) => [team.team, team.score, team.playerIds]),
		).toEqual([
			[1, 550, ["p2", "p3"]],
			[0, 500, ["p1"]],
		]);
		expect(results.entries.map((entry) => entry.team)).toEqual([0, 1, 1]);
	});

	it("classe les 4 équipes d'une partie à 8 joueurs", () => {
		const sim = new MatchSimulation({
			seed: 9,
			players: 8,
			config: { teamCount: 4 },
			teams: [0, 1, 2, 3, 0, 1, 2, 3],
		});
		silenceAnomalies(sim);
		for (let index = 0; index < 8; index += 1) {
			const player = sim.match.players.get(`p${index + 1}`) as MatchPlayer;
			player.score = (index % 4) * 100 + 50;
		}
		sim.run(MATCH_DURATION_MS / 1000 + 1);
		const results = sim.results as MatchResults;
		expect(results.winnerTeam).toBe(3);
		expect(results.teams.map((team) => team.team)).toEqual([3, 2, 1, 0]);
		expect(results.teams.every((team) => team.playerIds.length === 2)).toBe(
			true,
		);
	});

	it("empêche de saboter ses coéquipiers, mais pas ses adversaires", () => {
		const sim = new MatchSimulation({
			seed: 4242,
			players: 3,
			config: { teamCount: 2 },
			teams: [0, 0, 1],
		});
		silenceAnomalies(sim);
		const line = findClearLine(sim, 3.4);
		const direction = yawToDirection(line.yaw);
		const beside = (distance: number) => ({
			x: line.origin.x + direction.x * distance,
			y: line.origin.y,
			z: line.origin.z + direction.z * distance,
		});
		placeBot(sim, "p1", line.origin, line.yaw);
		placeBot(sim, "p2", beside(1.4), line.yaw + Math.PI);
		placeBot(sim, "p3", beside(2.2), line.yaw + Math.PI);
		sim.run(2.2);
		const caster = sim.match.players.get("p1") as MatchPlayer;
		const towardCaster = (id: string) => {
			const other = sim.match.players.get(id) as MatchPlayer;
			return Math.atan2(
				-(caster.position.x - other.position.x),
				-(caster.position.z - other.position.z),
			);
		};

		caster.casting = { since: sim.match.now };
		sim.match.handleShout("p2");
		sim.match.handlePush("p2", towardCaster("p2"));
		expect(caster.casting).not.toBeNull();
		expect(sim.transport.eventsOfType("push")).toHaveLength(0);

		sim.match.handleShout("p3");
		expect(caster.casting).toBeNull();
	});
});
