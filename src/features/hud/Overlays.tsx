import { useEffect, useState } from "react";
import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import styles from "./HudParts.module.scss";
import { hudStore } from "./hudStore";

function useNow(interval = 200): number {
	const [now, setNow] = useState(() => performance.now());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(performance.now()), interval);
		return () => window.clearInterval(timer);
	}, [interval]);
	return now;
}

export function Overlays() {
	const t = useT();
	const state = useStore(
		hudStore,
		(hud) => ({
			spotted: hud.spotted,
			gaze: hud.gaze,
			damageAt: hud.damageAt,
			dead: hud.dead,
			respawnAt: hud.respawnAt,
			hidden: hud.hidden,
			carried: hud.carried,
			slimed: hud.slimed,
			serverNow: hud.serverNow,
			health: hud.health,
		}),
		shallowEqual,
	);
	const now = useNow(100);
	const damage = Math.max(0, 1 - (now - state.damageAt) / 700);
	const spotted = Math.round(state.spotted * 100) / 100;
	return (
		<>
			<div className={styles.spotted} style={{ opacity: spotted }} />
			{state.gaze > 0.05 ? (
				<div
					className={styles.gaze}
					style={{ opacity: Math.min(1, state.gaze * 1.1) }}
				>
					{state.gaze > 0.35 ? (
						<p className={styles.gazeWarning}>{t.game.hud.lookAway}</p>
					) : null}
				</div>
			) : null}
			<div className={styles.damage} style={{ opacity: damage * 0.85 }} />
			{state.health < 30 && !state.dead ? (
				<div className={styles.lowHealth} />
			) : null}
			{state.slimed ? <div className={styles.slime} /> : null}
			{state.hidden ? <div className={styles.hidden} /> : null}
			{state.carried ? <div className={styles.carried} /> : null}
			{state.dead ? (
				<div className={styles.dead}>
					<p className={styles.deadTitle}>{t.game.hud.fallen}</p>
					<p className={styles.deadCount}>
						{t.game.hud.respawn(
							Math.max(
								0,
								Math.ceil((state.respawnAt - state.serverNow) / 1000),
							),
						)}
					</p>
				</div>
			) : null}
		</>
	);
}
