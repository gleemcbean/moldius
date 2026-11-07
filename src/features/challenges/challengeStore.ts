import {
	type ChallengeProgress,
	type CompletedChallenge,
	type MatchMetrics,
	newlyCompleted,
	withMatchMetrics,
} from "@shared/challenges";
import { useStore } from "../../hooks/useStore";
import { currentMessages, type Messages } from "../../i18n";
import { accountStore } from "../account/accountStore";
import { matchStore } from "../game/matchStore";
import { pushFeedback } from "../hud/hudStore";

function savedProgress(): ChallengeProgress {
	return accountStore.get().account?.challenges ?? {};
}

export function challengeLabel(
	t: Messages,
	completed: CompletedChallenge,
): string {
	const { name } = t.challenges.list[completed.id];
	return completed.tier === null ? name : `${name} ${completed.tier}`;
}

/** Le premier envoi d'une partie sert de référence : rien n'est annoncé deux fois. */
export function applyLiveMetrics(metrics: MatchMetrics): void {
	const previous = matchStore.get().challengeMetrics;
	matchStore.set({ challengeMetrics: metrics });
	if (!previous) {
		return;
	}
	const saved = savedProgress();
	const t = currentMessages();
	for (const completed of newlyCompleted(
		withMatchMetrics(saved, previous),
		withMatchMetrics(saved, metrics),
	)) {
		pushFeedback(
			t.challenges.completed(challengeLabel(t, completed)),
			"success",
		);
	}
}

/** Ce que le compte a enregistré, plus la partie en cours. */
export function useChallengeProgress(): ChallengeProgress {
	const saved = useStore(
		accountStore,
		(state) => state.account?.challenges ?? null,
	);
	const live = useStore(matchStore, (state) =>
		state.results ? null : state.challengeMetrics,
	);
	return withMatchMetrics(saved ?? {}, live ?? {});
}
