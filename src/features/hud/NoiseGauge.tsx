import { VOICE_AUDIBLE_LEVEL } from "@shared/config/index";
import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hudStore } from "./hudStore";
import styles from "./NoiseGauge.module.scss";

const SEGMENTS = 18;

export function NoiseGauge() {
	const t = useT();
	const gauge = useStore(
		hudStore,
		(state) => ({
			shown:
				!state.dead &&
				!state.carried &&
				(state.hidden || (state.crouching && !state.lanternOpen)),
			level: Math.min(1, Math.max(0, state.voiceLevel)),
		}),
		shallowEqual,
	);
	const lit = Math.round(gauge.level * SEGMENTS);
	const limit = Math.round(VOICE_AUDIBLE_LEVEL * SEGMENTS);
	const heard = gauge.level >= VOICE_AUDIBLE_LEVEL;
	return (
		<div
			className={[styles.gauge, gauge.shown ? styles.shown : ""].join(" ")}
			aria-hidden={!gauge.shown}
		>
			<span className={styles.label}>{t.game.hud.noise}</span>
			<div
				className={styles.track}
				role="meter"
				aria-label={t.game.hud.noise}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(gauge.level * 100)}
			>
				{Array.from({ length: SEGMENTS }, (_, index) => {
					const level = SEGMENTS - 1 - index;
					return (
						<span
							key={level.toString()}
							className={[
								styles.segment,
								level === limit ? styles.limit : "",
								level < lit
									? level >= limit
										? styles.loud
										: styles.quiet
									: "",
							].join(" ")}
						/>
					);
				})}
			</div>
			<span className={[styles.state, heard ? styles.heard : ""].join(" ")}>
				{heard ? t.game.hud.noiseHeard : t.game.hud.noiseQuiet}
			</span>
		</div>
	);
}
