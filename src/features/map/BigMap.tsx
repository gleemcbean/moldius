import { useEffect, useRef } from "react";
import { Button } from "../../components/Button";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import type { GameSession } from "../game/session/GameSession";
import { hazeFilter } from "../hud/hazeFilter";
import { hudStore } from "../hud/hudStore";
import styles from "./BigMap.module.scss";
import { MAP_MAX_ZOOM, mapStore, panMap, resetMap, zoomMap } from "./mapStore";

export function BigMap({ session }: { session: GameSession }) {
	const t = useT();
	const canvas = useRef<HTMLCanvasElement>(null);
	const state = useStore(mapStore, (map) => map);
	const haze = useStore(hudStore, (hud) => hud.haze);
	const levels = session.layout?.levels ?? [0];
	const drag = useRef<{ x: number; y: number } | null>(null);

	useEffect(() => {
		let frame = 0;
		const draw = () => {
			if (canvas.current) {
				session.drawBigMap(canvas.current);
			}
			frame = requestAnimationFrame(draw);
		};
		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	}, [session]);

	const scaleHint = () => {
		const element = canvas.current;
		const renderer = session.renderer;
		if (!element || !renderer) {
			return 10;
		}
		return (
			renderer.fitView(element.clientWidth, element.clientHeight, state.level)
				.scale * state.zoom
		);
	};

	return (
		<div className={styles.overlay}>
			<div className={styles.frame}>
				<header className={styles.header}>
					<h2>{t.game.map.title}</h2>
					<div className={styles.controls}>
						{levels.length > 1 ? (
							<div className={styles.levels}>
								{levels.map((level) => (
									<Button
										key={level}
										size="small"
										variant={state.level === level ? "primary" : "secondary"}
										onClick={() => resetMap(level)}
									>
										{t.game.map.levelName(level)}
									</Button>
								))}
							</div>
						) : null}
						<Button
							size="small"
							variant="secondary"
							onClick={() => zoomMap(-1)}
							disabled={state.zoom <= 1}
						>
							−
						</Button>
						<span className={styles.zoom}>×{state.zoom.toFixed(1)}</span>
						<Button
							size="small"
							variant="secondary"
							onClick={() => zoomMap(1)}
							disabled={state.zoom >= MAP_MAX_ZOOM}
						>
							+
						</Button>
						<Button size="small" variant="secondary" onClick={() => resetMap()}>
							{t.game.map.recenter}
						</Button>
						<Button size="small" onClick={() => session.closeMap()}>
							{t.game.map.close}
						</Button>
					</div>
				</header>
				<canvas
					ref={canvas}
					className={styles.canvas}
					style={{ filter: hazeFilter(haze) }}
					onPointerDown={(event) => {
						drag.current = { x: event.clientX, y: event.clientY };
						event.currentTarget.setPointerCapture(event.pointerId);
					}}
					onPointerMove={(event) => {
						if (!drag.current) {
							return;
						}
						const scale = scaleHint();
						panMap(
							-(event.clientX - drag.current.x) / scale,
							-(event.clientY - drag.current.y) / scale,
						);
						drag.current = { x: event.clientX, y: event.clientY };
					}}
					onPointerUp={() => {
						drag.current = null;
					}}
				/>
				<footer className={styles.footer}>
					<ul className={styles.legend}>
						<li>
							<span className={styles.you} />
							{t.game.map.legend.you}
						</li>
						<li>
							<span className={styles.other} />
							{t.game.map.legend.players}
						</li>
						<li>
							<span className={styles.elsewhere}>↑</span>
							{t.game.map.legend.elsewhere}
						</li>
						<li>
							<span className={styles.current} />
							{t.game.map.legend.current}
						</li>
						<li>
							<span className={styles.door} />
							{t.game.map.legend.door}
						</li>
						<li>
							<span className={styles.window} />
							{t.game.map.legend.window}
						</li>
						<li>
							<span className={styles.stairs}>↑</span>
							{t.game.map.legend.stairs}
						</li>
					</ul>
					<p className={styles.hint}>{t.game.map.footer}</p>
				</footer>
			</div>
		</div>
	);
}
