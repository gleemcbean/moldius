import { useEffect, useRef } from "react";
import { useStore } from "../../hooks/useStore";
import type { GameSession } from "../game/session/GameSession";
import styles from "./HudParts.module.scss";
import { hazeFilter } from "./hazeFilter";
import { hudStore } from "./hudStore";

export function Minimap({ session }: { session: GameSession }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const haze = useStore(hudStore, (state) => state.haze);
	useEffect(() => {
		session.setMinimap(canvas.current);
		return () => session.setMinimap(null);
	}, [session]);
	return (
		<div className={styles.minimap}>
			<canvas
				ref={canvas}
				className={styles.minimapCanvas}
				style={{ filter: hazeFilter(haze) }}
			/>
		</div>
	);
}
