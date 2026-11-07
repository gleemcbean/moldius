import type { HatPattern } from "@shared/hatPatterns";
import { type LanternTint, type Reward, rewardProgress } from "@shared/rewards";
import type { Messages } from "../../i18n";

export function rewardName(t: Messages, reward: Reward): string {
	return reward.kind === "hat"
		? t.appearance.patterns[reward.value as HatPattern]
		: t.appearance.lanterns[reward.value as LanternTint];
}

/** Le même texte partout : l'accueil, le profil et ses récompenses. */
export function rewardRequirement(t: Messages, reward: Reward): string {
	const { name, description } = t.challenges.list[reward.challenge];
	const task = description(
		t.common.number(rewardProgress(reward, null).target),
	);
	return reward.tier === null
		? t.challenges.requireClassic(name, task)
		: t.challenges.requireTier(reward.tier, name, task);
}
