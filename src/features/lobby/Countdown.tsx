import { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { clockSync } from "../network/clockSync";
import styles from "./LobbyScreen.module.scss";

export function Countdown({ endsAt }: { endsAt: number }) {
	const t = useT();
	const [remaining, setRemaining] = useState(() =>
		Math.max(0, endsAt - clockSync.serverNow()),
	);
	useEffect(() => {
		const timer = window.setInterval(
			() => setRemaining(Math.max(0, endsAt - clockSync.serverNow())),
			200,
		);
		return () => window.clearInterval(timer);
	}, [endsAt]);
	return (
		<span className={styles.countdown}>
			{t.lobby.countdown(Math.ceil(remaining / 1000))}
		</span>
	);
}
