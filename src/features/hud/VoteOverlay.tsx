import { type CSSProperties, useEffect, useState } from "react";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { voteStore } from "../game/voteStore";
import { clockSync } from "../network/clockSync";
import { getSocket } from "../network/socket";
import styles from "./VoteOverlay.module.scss";

function castVote(targetId: string): void {
	getSocket().emit("game:vote", { targetId });
	voteStore.set({ choice: targetId });
}

export function VoteOverlay() {
	const t = useT();
	const labels = t.party.possessed;
	const vote = useStore(voteStore, (state) => state);
	const [now, setNow] = useState(() => clockSync.serverNow());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(clockSync.serverNow()), 250);
		return () => window.clearInterval(timer);
	}, []);
	if (!vote.open) {
		return null;
	}
	const seconds = Math.max(0, Math.ceil((vote.endsAt - now) / 1000));
	const voted = vote.candidates.filter((candidate) => candidate.voted).length;
	return (
		<div className={styles.overlay} data-pad-scope="">
			<section className={styles.panel}>
				<header className={styles.header}>
					<h2>{labels.voteTitle}</h2>
					<span className={styles.timer}>{labels.voteRemaining(seconds)}</span>
				</header>
				<p className={styles.text}>{labels.voteText}</p>
				<ul className={styles.list}>
					{vote.candidates.map((candidate) => (
						<li key={candidate.id}>
							<button
								type="button"
								className={[
									styles.candidate,
									vote.choice === candidate.id ? styles.chosen : "",
								].join(" ")}
								disabled={candidate.self}
								onClick={() => castVote(candidate.id)}
								style={
									{ "--swatch": hexColor(candidate.color) } as CSSProperties
								}
								data-selectable=""
							>
								<i className={styles.swatch} />
								<span className={styles.name}>
									{candidate.self ? labels.you : candidate.name}
								</span>
								{candidate.voted ? (
									<span className={styles.voted}>{labels.hasVoted}</span>
								) : null}
							</button>
						</li>
					))}
				</ul>
				<footer className={styles.footer}>
					<span>{labels.voted(voted, vote.candidates.length)}</span>
					{vote.choice ? <span>{labels.voteCast}</span> : null}
				</footer>
			</section>
		</div>
	);
}
