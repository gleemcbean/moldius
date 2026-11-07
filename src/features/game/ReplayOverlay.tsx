import { useEffect } from "react";
import { Button } from "../../components/Button";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import styles from "./GameScreen.module.scss";
import { replayStore } from "./replayStore";
import type { GameSession } from "./session/GameSession";

function VoiceMeter() {
	const t = useT();
	const voice = useStore(replayStore, (state) => state.voice);
	return (
		<div className={styles.replayVoice} aria-hidden="true">
			<span>{t.game.highlights.voice}</span>
			<i style={{ width: `${Math.round(voice * 100)}%` }} />
		</div>
	);
}

export function ReplayOverlay({ session }: { session: GameSession }) {
	const t = useT();
	const labels = t.game.highlights;
	const moment = useStore(replayStore, (state) => state.moment);
	const index = useStore(replayStore, (state) => state.index);
	const total = useStore(replayStore, (state) => state.total);
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.code === "Space" || event.code === "Enter") {
				event.preventDefault();
				session.skipHighlight();
			} else if (event.code === "Escape") {
				session.skipAllHighlights();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [session]);
	if (!moment) {
		return null;
	}
	const species = moment.species
		? labels.speciesName(t.grimoire.species[moment.species].name)
		: labels.unknownSpecies;
	return (
		<div className={styles.replay}>
			<header className={styles.replayHead}>
				<strong>{labels.title}</strong>
				<span>{labels.counter(index + 1, total)}</span>
			</header>
			<div className={styles.replayCaption} key={index}>
				<p style={{ borderColor: hexColor(moment.color) }}>
					{labels.moments[moment.kind]({
						name: moment.name,
						other: moment.other ?? labels.someone,
						species,
						value: moment.value,
					})}
				</p>
				<VoiceMeter />
			</div>
			<footer className={styles.replayActions}>
				<Button variant="secondary" onClick={() => session.skipHighlight()}>
					{labels.next}
				</Button>
				<Button variant="ghost" onClick={() => session.skipAllHighlights()}>
					{labels.skip}
				</Button>
			</footer>
		</div>
	);
}
