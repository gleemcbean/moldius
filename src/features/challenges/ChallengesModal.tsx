import {
	CHALLENGE_STEP_COUNT,
	type ChallengeId,
	type ChallengeMetric,
	CLASSIC_CHALLENGES,
	classicStatus,
	completedStepCount,
	INCREMENTAL_CHALLENGES,
	incrementalStatus,
	METRIC_UNITS,
} from "@shared/challenges";
import type { HatPattern } from "@shared/hatPatterns";
import {
	LANTERN_TINT_COLORS,
	type LanternTint,
	rewardsForChallenge,
	type Tagline,
} from "@shared/rewards";
import { Meter } from "../../components/Controls";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { TaglineBadge } from "../../components/TaglineBadge";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { accountStore } from "../account/accountStore";
import { settingsStore } from "../settings/settingsStore";
import styles from "./ChallengesModal.module.scss";
import { useChallengeProgress } from "./challengeStore";
import { rewardName } from "./rewardLabels";

function ChallengeRewards({ id }: { id: ChallengeId }) {
	const t = useT();
	const hatColor = useStore(settingsStore, (state) => state.playerColor);
	return rewardsForChallenge(id).map((reward) => {
		const name = rewardName(t, reward);
		return (
			<span key={reward.value} className={styles.reward}>
				{reward.kind === "hat" ? (
					<HatPreview
						className={styles.rewardHat}
						color={hatColor}
						pattern={reward.value as HatPattern}
					/>
				) : reward.kind === "tagline" ? (
					<TaglineBadge tagline={reward.value as Tagline} chip />
				) : (
					<span
						className={styles.rewardLantern}
						style={{
							color: hexColor(LANTERN_TINT_COLORS[reward.value as LanternTint]),
						}}
					>
						<Icon name="lantern" />
					</span>
				)}
				{reward.tier === null
					? t.challenges.reward(name)
					: t.challenges.tierReward(reward.tier, name)}
			</span>
		);
	});
}

export function ChallengesModal({ onClose }: { onClose: () => void }) {
	const t = useT();
	const labels = t.challenges;
	const progress = useChallengeProgress();
	const status = useStore(accountStore, (state) => state.status);
	const amount = (metric: ChallengeMetric, value: number) => {
		const unit = METRIC_UNITS[metric];
		const text = t.common.number(Math.floor(value));
		return unit ? labels.units[unit](text) : text;
	};
	const number = (value: number) => t.common.number(value);
	return (
		<Modal title={labels.title} onClose={onClose} wide>
			<p className={styles.summary}>
				{labels.summary(completedStepCount(progress), CHALLENGE_STEP_COUNT)}
			</p>
			{status === "signed-in" ? null : (
				<p className={styles.note}>{labels.signInHint}</p>
			)}
			<div className={styles.columns}>
				<section>
					<h3>{labels.classic}</h3>
					<p className={styles.hint}>{labels.classicHint}</p>
					<ul className={styles.list}>
						{CLASSIC_CHALLENGES.map((challenge) => {
							const state = classicStatus(challenge, progress);
							const text = labels.list[challenge.id];
							return (
								<li
									key={challenge.id}
									className={state.done ? styles.done : ""}
								>
									<span className={styles.mark}>
										{state.done ? <Icon name="check" /> : null}
									</span>
									<span className={styles.body}>
										<strong>{text.name}</strong>
										<span>{text.description(number(challenge.target))}</span>
										<ChallengeRewards id={challenge.id} />
									</span>
									<span className={styles.count}>
										{state.done
											? null
											: `${amount(challenge.metric, state.value)} / ${amount(challenge.metric, state.target)}`}
									</span>
								</li>
							);
						})}
					</ul>
				</section>
				<section>
					<h3>{labels.incremental}</h3>
					<p className={styles.hint}>{labels.incrementalHint}</p>
					<ul className={styles.list}>
						{INCREMENTAL_CHALLENGES.map((challenge) => {
							const state = incrementalStatus(challenge, progress);
							const text = labels.list[challenge.id];
							return (
								<li
									key={challenge.id}
									className={[
										styles.tiered,
										state.done ? styles.done : "",
									].join(" ")}
								>
									<span className={styles.mark}>
										{state.done ? <Icon name="check" /> : null}
									</span>
									<span className={styles.body}>
										<strong>
											{text.name}
											<em>{labels.tier(state.tier, challenge.tiers.length)}</em>
										</strong>
										<span>{text.description(number(state.target))}</span>
										<ChallengeRewards id={challenge.id} />
										<span className={styles.progress}>
											<Meter
												value={state.value}
												max={state.target}
												label={text.name}
											/>
											<span className={styles.count}>
												{`${amount(challenge.metric, state.value)} / ${amount(challenge.metric, state.target)}`}
											</span>
										</span>
									</span>
								</li>
							);
						})}
					</ul>
				</section>
			</div>
		</Modal>
	);
}
