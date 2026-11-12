import { levelProgress, matchXpParts } from "@shared/progression";
import { levelRewards } from "@shared/rewards";
import { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { rewardName } from "../challenges/rewardLabels";
import styles from "./LevelProgress.module.scss";

export function LevelProgress({
	xp,
	gained = 0,
	showNextReward = true,
}: {
	xp: number;
	gained?: number;
	showNextReward?: boolean;
}) {
	const t = useT();
	const after = levelProgress(xp);
	const before = levelProgress(Math.max(0, xp - gained));
	const leveledUp = after.level > before.level;
	const start = gained > 0 && !leveledUp ? before.into / before.needed : 0;
	const end = after.into / after.needed;
	const [fill, setFill] = useState(gained > 0 ? start : end);
	useEffect(() => {
		if (gained <= 0) {
			setFill(end);
			return;
		}
		const frame = requestAnimationFrame(() =>
			requestAnimationFrame(() => setFill(end)),
		);
		return () => cancelAnimationFrame(frame);
	}, [gained, end]);
	const next = levelRewards().find(
		(reward) => (reward.level ?? 0) > after.level,
	);
	return (
		<div className={styles.progress}>
			<div className={styles.header}>
				<strong className={styles.level}>
					{t.progression.level(after.level)}
				</strong>
				{gained > 0 ? (
					<span className={styles.gained}>
						{t.progression.gained(t.common.number(gained))}
					</span>
				) : null}
				<span className={styles.count}>
					{t.progression.xpOf(
						t.common.number(after.into),
						t.common.number(after.needed),
					)}
				</span>
			</div>
			<span
				className={styles.bar}
				role="meter"
				aria-valuenow={after.into}
				aria-valuemin={0}
				aria-valuemax={after.needed}
				aria-label={t.progression.level(after.level)}
			>
				<span
					className={styles.fill}
					style={{ width: `${Math.round(fill * 1000) / 10}%` }}
				/>
			</span>
			{leveledUp ? (
				<p className={styles.levelUp}>{t.progression.levelUp(after.level)}</p>
			) : null}
			{showNextReward ? (
				<p className={styles.next}>
					{next
						? t.progression.nextReward(next.level ?? 0, rewardName(t, next))
						: t.progression.allRewards}
				</p>
			) : null}
		</div>
	);
}

export function XpBreakdown({ score, won }: { score: number; won: boolean }) {
	const t = useT();
	const parts = matchXpParts({ score, won });
	return (
		<p className={styles.breakdown}>
			{t.progression.breakdown(parts.base, parts.score, parts.win)}
		</p>
	);
}
