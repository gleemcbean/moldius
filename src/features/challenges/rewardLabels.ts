import type { HatPattern } from "@shared/hatPatterns";
import {
	type LanternTint,
	type Reward,
	rewardProgress,
	type Tagline,
} from "@shared/rewards";
import type { Messages } from "../../i18n";

export function rewardName(t: Messages, reward: Reward): string {
	switch (reward.kind) {
		case "hat":
			return t.appearance.patterns[reward.value as HatPattern];
		case "lantern":
			return t.appearance.lanterns[reward.value as LanternTint];
		case "tagline":
			return t.appearance.taglines[reward.value as Tagline];
	}
}

/** Le même texte partout : l'accueil, le profil et ses récompenses. */
export function rewardRequirement(t: Messages, reward: Reward): string {
	if (reward.challenge === null) {
		return t.challenges.requireLevel(reward.level ?? 1);
	}
	const { name, description } = t.challenges.list[reward.challenge];
	const task = description(
		t.common.number(rewardProgress(reward, null).target),
	);
	return reward.tier === null
		? t.challenges.requireClassic(name, task)
		: t.challenges.requireTier(reward.tier, name, task);
}
