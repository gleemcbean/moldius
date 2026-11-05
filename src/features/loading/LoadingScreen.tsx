import { Button } from "../../components/Button";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { leaveMatch } from "../game/matchController";
import { matchStore } from "../game/matchStore";
import styles from "./LoadingScreen.module.scss";

export function LoadingScreen() {
	const t = useT();
	const labels = t.game.loading;
	const steps = useStore(matchStore, (state) => state.loadingSteps);
	const loaded = useStore(matchStore, (state) => state.loaded);
	const error = useStore(matchStore, (state) => state.error);
	const total =
		steps.length === 0
			? 0
			: steps.reduce((sum, step) => sum + step.progress, 0) / steps.length;
	const current = steps.find((step) => step.progress < 1);
	return (
		<main className={styles.loading}>
			<div className={styles.panel}>
				<p className={styles.kicker}>{labels.kicker}</p>
				<h1 className={styles.title}>
					{loaded
						? labels.waiting
						: current
							? labels.steps[current.id]
							: labels.preparing}
				</h1>
				<div
					className={styles.bar}
					role="progressbar"
					aria-valuenow={Math.round(total * 100)}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					<div className={styles.fill} style={{ width: `${total * 100}%` }} />
					<span className={styles.percent}>{t.common.percent(total)}</span>
				</div>
				<ol className={styles.steps}>
					{steps.map((step) => (
						<li
							key={step.id}
							className={
								step.progress >= 1
									? styles.done
									: step === current
										? styles.active
										: ""
							}
						>
							<span className={styles.check}>
								{step.progress >= 1 ? "■" : step === current ? "▶" : "□"}
							</span>
							{labels.steps[step.id]}
							<span className={styles.stepPercent}>
								{t.common.percent(step.progress)}
							</span>
						</li>
					))}
				</ol>
				{error ? (
					<div className={styles.error}>
						<p>{error}</p>
						<Button variant="secondary" onClick={leaveMatch}>
							{labels.back}
						</Button>
					</div>
				) : null}
				<p className={styles.hint}>{labels.hint}</p>
			</div>
		</main>
	);
}
