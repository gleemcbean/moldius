import { useEffect, useRef } from "react";
import styles from "./FilmOverlay.module.scss";

export function FilmOverlay({ canvas }: { canvas: HTMLCanvasElement }) {
	const host = useRef<HTMLDivElement>(null);

	useEffect(() => {
		host.current?.appendChild(canvas);

		return () => canvas.remove();
	}, [canvas]);

	return (
		<div className={styles.overlay}>
			<div className={styles.beam} />
			<div className={styles.screen} ref={host} />
		</div>
	);
}
