import { describe, expect, it } from "vitest";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import {
	CHALLENGE_METRICS,
	CHALLENGE_STEP_COUNT,
	type ChallengeProgress,
	CLASSIC_CHALLENGES,
	classicStatus,
	completedStepCount,
	INCREMENTAL_CHALLENGES,
	incrementalStatus,
	newlyCompleted,
	sanitizeChallengeProgress,
	withMatchMetrics,
} from "../shared/challenges.js";
import { MATCH_DURATION_MS } from "../shared/config/index.js";
import {
	dailyDateKey,
	formatDailyCountdown,
	msUntilNextDaily,
} from "../shared/dailyChallenge.js";
import { generateManor } from "../shared/manor/generateManor.js";
import {
	defaultPrivateConfig,
	sanitizeMatchConfig,
	TUTORIAL_MATCH_CONFIG,
} from "../shared/matchConfig.js";
import type { MatchResults } from "../shared/protocol/game.js";
import {
	hatUnlocked,
	lanternUnlocked,
	newlyUnlocked,
	REWARDS,
	rewardFor,
	rewardProgress,
	rewardsForChallenge,
} from "../shared/rewards.js";
import { silenceAnomalies } from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

const hatTrick = CLASSIC_CHALLENGES.find(({ id }) => id === "hatTrick");
const hunter = INCREMENTAL_CHALLENGES.find(({ id }) => id === "hunter");

describe("défis", () => {
	it("demande un classique en une seule partie, sans additionner", () => {
		if (!hatTrick) {
			throw new Error("défi manquant");
		}
		const twoGames = withMatchMetrics(withMatchMetrics({}, { captures: 2 }), {
			captures: 2,
		});
		expect(classicStatus(hatTrick, twoGames).done).toBe(false);
		expect(twoGames.captures).toEqual({ total: 4, best: 2 });
		const after = withMatchMetrics(twoGames, { captures: 3 });
		expect(classicStatus(hatTrick, after).done).toBe(true);
	});

	it("additionne un incrémental, palier après palier", () => {
		if (!hunter) {
			throw new Error("défi manquant");
		}
		const start = withMatchMetrics({}, { captures: 8 });
		expect(incrementalStatus(hunter, start)).toMatchObject({
			value: 8,
			target: 10,
			tier: 0,
			done: false,
		});
		const after = withMatchMetrics(start, { captures: 45 });
		expect(incrementalStatus(hunter, after)).toMatchObject({
			target: 200,
			tier: 2,
		});
		expect(
			incrementalStatus(hunter, withMatchMetrics(after, { captures: 500 })),
		).toMatchObject({ value: 200, tier: 3, done: true });
	});

	it("annonce chaque défi une seule fois, même plusieurs paliers d'un coup", () => {
		const before: ChallengeProgress = { captures: { total: 9, best: 2 } };
		const after = withMatchMetrics(before, { captures: 3 });
		expect(newlyCompleted(before, after)).toEqual([
			{ id: "hatTrick", tier: null },
			{ id: "hunter", tier: 1 },
		]);
		expect(newlyCompleted(after, after)).toEqual([]);
		const huge = withMatchMetrics({}, { games: 100 });
		expect(
			newlyCompleted({}, huge).filter(({ id }) => id === "veteran"),
		).toHaveLength(3);
	});

	it("compte le total de défis et chaque défi a une mesure connue", () => {
		const all: ChallengeProgress = Object.fromEntries(
			CHALLENGE_METRICS.map((metric) => [
				metric,
				{ total: 1_000_000, best: 1_000_000 },
			]),
		);
		expect(completedStepCount(all)).toBe(CHALLENGE_STEP_COUNT);
		expect(completedStepCount({})).toBe(0);
	});

	it("ignore une progression abîmée", () => {
		expect(sanitizeChallengeProgress("pas du json")).toEqual({});
		expect(sanitizeChallengeProgress(null)).toEqual({});
		expect(
			sanitizeChallengeProgress(
				'{"captures":{"total":5,"best":"x"},"inconnu":{"total":1,"best":1}}',
			),
		).toEqual({ captures: { total: 5, best: 0 } });
	});

	it("mesure la partie, envoie le suivi au joueur et finit avec le bilan", () => {
		const sim = new MatchSimulation({ seed: 21, players: 2 });
		silenceAnomalies(sim);
		const p1 = sim.match.players.get("p1") as MatchPlayer;
		const p2 = sim.match.players.get("p2") as MatchPlayer;
		sim.match.awards.event(
			{ type: "capture", playerId: "p1" } as never,
			sim.match.players,
		);
		sim.run(3);
		const sent = sim.transport.messages.filter(
			(entry) => entry.event === "game:challenges" && entry.target === "p1",
		);
		expect(sent.length).toBeGreaterThan(0);
		p1.score = 300;
		p2.score = 100;
		sim.run(MATCH_DURATION_MS / 1000 + 1);
		const results = sim.results as MatchResults;
		expect(results.metrics.p1).toMatchObject({
			games: 1,
			wins: 1,
			captures: 1,
			flawless: 1,
			flawlessWins: 1,
			dailies: 0,
		});
		expect(results.metrics.p2).toMatchObject({ games: 1, wins: 0 });
	});
});

describe("récompenses de défis", () => {
	const base = { gamesPlayed: 0, wins: 0, captures: 0, dailies: 0, awards: 0 };

	it("débloque un motif en réussissant un défi classique", () => {
		expect(hatUnlocked("lightning", { ...base, challenges: {} })).toBe(false);
		expect(hatUnlocked("lightning", null)).toBe(false);
		const challenges = withMatchMetrics({}, { sprintMeters: 500 });
		expect(hatUnlocked("lightning", { ...base, challenges })).toBe(true);
		const split = withMatchMetrics(
			withMatchMetrics({}, { sprintMeters: 300 }),
			{ sprintMeters: 300 },
		);
		expect(hatUnlocked("lightning", { ...base, challenges: split })).toBe(
			false,
		);
	});

	it("débloque une lanterne au palier demandé, pas avant", () => {
		const reach = (hideSeconds: number) => ({
			...base,
			challenges: withMatchMetrics({}, { hideSeconds }),
		});
		expect(lanternUnlocked("specter", reach(300))).toBe(false);
		const reward = rewardFor("lantern", "specter");
		expect(reward && rewardProgress(reward, reach(300))).toEqual({
			value: 300,
			target: 1800,
		});
		expect(lanternUnlocked("specter", reach(1800))).toBe(true);
	});

	it("annonce une récompense quand le défi la débloque", () => {
		const before = { ...base, challenges: {} };
		const after = {
			...base,
			challenges: withMatchMetrics({}, { flawlessWins: 1 }),
		};
		expect(newlyUnlocked(before, after).map(({ value }) => value)).toEqual([
			"laurel",
		]);
	});

	it("rattache chaque récompense à un défi de la liste", () => {
		const ids = new Set<string>([
			...CLASSIC_CHALLENGES.map(({ id }) => id),
			...INCREMENTAL_CHALLENGES.map(({ id }) => id),
		]);
		for (const reward of REWARDS) {
			expect(ids.has(reward.challenge), reward.value).toBe(true);
		}
	});

	it("renvoie chaque récompense vers un défi et un palier qui existent", () => {
		for (const reward of REWARDS) {
			const { target } = rewardProgress(reward, null);
			expect(target, reward.value).toBeGreaterThan(0);
			expect(rewardsForChallenge(reward.challenge)).toContain(reward);
		}
		expect(rewardsForChallenge("bunny")).toEqual([]);
	});
});

describe("mode de jeu du jour", () => {
	it("compte jusqu'à minuit UTC", () => {
		const now = Date.parse("2026-11-07T23:59:30Z");
		expect(msUntilNextDaily(now)).toBe(30_000);
		expect(formatDailyCountdown(msUntilNextDaily(now))).toBe("00:00:30");
		expect(dailyDateKey(now + msUntilNextDaily(now))).toBe("2026-11-08");
		expect(formatDailyCountdown(5 * 3_600_000 + 12 * 60_000 + 3_000)).toBe(
			"05:12:03",
		);
		expect(msUntilNextDaily(Date.parse("2026-11-08T00:00:00Z"))).toBe(
			86_400_000,
		);
	});
});

describe("salles à enjeu comme salles normales", () => {
	it("en fait de vraies salles, avec leur autel", () => {
		const layout = generateManor(77, defaultPrivateConfig());
		for (const stake of layout.stakes) {
			expect(layout.rooms[stake.roomId].type).toBe(stake.kind);
		}
		expect(new Set(layout.stakes.map((stake) => stake.kind)).size).toBe(3);
	});

	it("se choisissent une par une dans les types de salles", () => {
		const config = defaultPrivateConfig();
		const roomTypes = config.roomTypes.filter((type) => type !== "pact");
		const kinds = new Set(
			generateManor(77, { ...config, roomTypes }).stakes.map(
				(stake) => stake.kind,
			),
		);
		expect([...kinds].sort()).toEqual(["reliquary", "sanctuary"]);
		expect(
			sanitizeMatchConfig({ ...config, roomTypes }, config).roomTypes,
		).not.toContain("pact");
		expect(TUTORIAL_MATCH_CONFIG.roomTypes).not.toContain("sanctuary");
	});
});
