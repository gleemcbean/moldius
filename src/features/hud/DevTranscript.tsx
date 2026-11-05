import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import styles from "./HudParts.module.scss";
import { hudStore } from "./hudStore";

export function DevTranscript() {
	const t = useT();
	const labels = t.game.dev;
	const state = useStore(
		hudStore,
		(hud) => ({
			dev: hud.devMode,
			casts: hud.devCasts,
			live: hud.devLive,
		}),
		shallowEqual,
	);
	if (!state.dev) {
		return null;
	}
	return (
		<aside className={styles.devTranscript}>
			<p className={styles.devTitle}>{labels.title}</p>
			{state.live.text ? (
				<p className={state.live.matches ? styles.devOk : styles.devLive}>
					{labels.live} « {state.live.text || "…"} »
					{state.live.matches ? ` ${labels.liveMatch}` : ""}
				</p>
			) : null}
			{state.casts.length === 0 && !state.live.text ? (
				<p className={styles.devMuted}>{labels.empty}</p>
			) : null}
			{state.casts.map((entry) => (
				<div key={entry.id} className={styles.devEntry}>
					{entry.transcripts.map((text, index) => (
						<p
							key={`${entry.id}:${text}`}
							className={index === 0 ? styles.devHeard : styles.devMuted}
						>
							{index === 0 ? labels.heard : labels.alternative} « {text} »
						</p>
					))}
					<p className={entry.matchedLabel ? styles.devOk : styles.devBad}>
						{entry.matchedLabel
							? `${labels.matches(entry.matchedLabel)} · ${labels.expected} « ${entry.expected.join(" ")} »`
							: labels.noMatch}
					</p>
					<p className={styles.devMuted}>
						{entry.result === "ignored"
							? labels.ignored
							: entry.result === "pending"
								? labels.pending
								: entry.result === "ok"
									? labels.captured
									: labels.refused(t.game.cast.reasons[entry.result])}
					</p>
				</div>
			))}
		</aside>
	);
}
