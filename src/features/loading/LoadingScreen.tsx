import { TUTORIAL_DUMMY_ID } from "@shared/tutorial";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { leaveMatch } from "../game/matchController";
import { matchStore } from "../game/matchStore";
import { sessionStore } from "../network/sessionStore";
import { LoadingBackdrop } from "./LoadingBackdrop";
import styles from "./LoadingScreen.module.scss";
import type { ApproachWalker } from "./ManorApproachScene";

const TIP_INTERVAL_MS = 8000;

export function LoadingScreen() {
	const t = useT();
	const labels = t.game.loading;
	const steps = useStore(matchStore, (state) => state.loadingSteps);
	const loaded = useStore(matchStore, (state) => state.loaded);
	const error = useStore(matchStore, (state) => state.error);
	const init = useStore(matchStore, (state) => state.init);
	const playerId = useStore(sessionStore, (state) => state.playerId);
	const [tip, setTip] = useState(() =>
		Math.floor(Math.random() * labels.tips.length),
	);
	const total =
		steps.length === 0
			? 0
			: steps.reduce((sum, step) => sum + step.progress, 0) / steps.length;
	const current = steps.find((step) => step.progress < 1);
	const players = useMemo(() => {
		const list = (init?.players ?? []).filter(
			(player) => player.id !== TUTORIAL_DUMMY_ID,
		);
		return [
			...list.filter((player) => player.id === playerId),
			...list.filter((player) => player.id !== playerId),
		];
	}, [init, playerId]);
	const walkers = useMemo<ApproachWalker[]>(
		() =>
			players.map(({ id, color, pattern, lantern }) => ({
				id,
				color,
				pattern,
				lantern,
			})),
		[players],
	);

	useEffect(() => {
		const timer = window.setInterval(
			() => setTip((index) => (index + 1) % labels.tips.length),
			TIP_INTERVAL_MS,
		);
		return () => window.clearInterval(timer);
	}, [labels.tips.length]);

	return (
		<main className={styles.loading}>
			{init ? <LoadingBackdrop key={init.matchId} walkers={walkers} /> : null}
			<div className={styles.shade} />
			{players.length > 0 ? (
				<aside className={styles.party} aria-label={labels.party}>
					<p className={styles.partyTitle}>{labels.party}</p>
					<ul>
						{players.map((player) => (
							<li key={player.id}>
								<span
									className={styles.dot}
									style={{ background: hexColor(player.color) }}
								/>
								<span className={styles.partyName}>{player.name}</span>
								{player.id === playerId ? (
									<span className={styles.you}>{labels.you}</span>
								) : null}
							</li>
						))}
					</ul>
				</aside>
			) : null}
			<div className={styles.panel}>
				<p className={styles.kicker}>{labels.kicker}</p>
				<h1 className={styles.title} aria-live="polite">
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
				</div>
				{error ? (
					<div className={styles.error}>
						<p>{error}</p>
						<Button variant="secondary" onClick={leaveMatch}>
							{labels.back}
						</Button>
					</div>
				) : (
					<p className={styles.tip} key={tip}>
						<span className={styles.tipLabel}>{labels.tipLabel}</span>
						{labels.tips[tip]}
					</p>
				)}
			</div>
		</main>
	);
}
