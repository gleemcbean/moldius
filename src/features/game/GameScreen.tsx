import { useEffect, useRef } from "react";
import { Hud } from "../hud/Hud";
import styles from "./GameScreen.module.scss";
import { currentSession } from "./matchController";

export function GameScreen() {
	const host = useRef<HTMLDivElement>(null);
	const session = currentSession();
	useEffect(() => {
		if (!session || !host.current) {
			return;
		}
		session.attach(host.current);
		return () => session.detach();
	}, [session]);
	return (
		<main className={styles.game}>
			<div ref={host} className={styles.viewport} />
			{session ? <Hud session={session} /> : null}
		</main>
	);
}
