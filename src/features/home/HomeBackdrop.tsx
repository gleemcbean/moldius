import { useEffect, useRef } from "react";
import { holdBoot } from "../../app/boot";
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
		// L'écran de chargement attend la première image du décor, shaders compilés.
		const release = holdBoot();
		try {
			const settings = settingsStore.get();
			scene.current = new HomeScene(
				element,
				settings.playerColor,
				settings.playerPattern,
			);
			scene.current.onFirstFrame = release;
		} catch {
			scene.current = null;
			release();
		}
		return () => {
			release();
			scene.current?.dispose();
			scene.current = null;
		};
	}, []);
	useEffect(() => {
		scene.current?.setAppearance(color, pattern);
	}, [color, pattern]);
	return <div ref={host} className={styles.backdrop} aria-hidden="true" />;
}
