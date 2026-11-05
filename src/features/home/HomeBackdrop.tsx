import { useEffect, useRef } from "react";
import { useStore } from "../../hooks/useStore";
import { settingsStore } from "../settings/settingsStore";
import styles from "./HomeBackdrop.module.scss";
import { HomeScene } from "./HomeScene";

export function HomeBackdrop() {
	const host = useRef<HTMLDivElement>(null);
	const scene = useRef<HomeScene | null>(null);
	const color = useStore(settingsStore, (state) => state.playerColor);
	const pattern = useStore(settingsStore, (state) => state.playerPattern);
	useEffect(() => {
		const element = host.current;
		if (!element) {
			return;
		}
		try {
			const settings = settingsStore.get();
			scene.current = new HomeScene(
				element,
				settings.playerColor,
				settings.playerPattern,
			);
		} catch {
			scene.current = null;
		}
		return () => {
			scene.current?.dispose();
			scene.current = null;
		};
	}, []);
	useEffect(() => {
		scene.current?.setAppearance(color, pattern);
	}, [color, pattern]);
	return <div ref={host} className={styles.backdrop} aria-hidden="true" />;
}
