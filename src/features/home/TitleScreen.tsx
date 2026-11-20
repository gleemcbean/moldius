import { useEffect, useState } from "react";
import { whenBooted } from "../../app/boot";
import { COPYRIGHT_YEAR, STUDIO_NAME } from "../../config/studio";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { audioEngine } from "../audio/audioEngine";
import { playUiClick } from "../audio/uiSounds";
import styles from "./TitleScreen.module.scss";
import { enterMenu, titleStore } from "./titleStore";

const IGNORED_KEYS = new Set([
	"Shift",
	"Control",
	"Alt",
	"Meta",
	"AltGraph",
	"CapsLock",
	"Tab",
	"F5",
	"F11",
	"F12",
]);

function anyPadButton(): boolean {
	for (const pad of navigator.getGamepads?.() ?? []) {
		if (pad?.buttons.some((button) => button.pressed)) {
			return true;
		}
	}

	return false;
}

function useAnyInput(onInput: () => void, armed: boolean): void {
	useEffect(() => {
		if (!armed) {
			return;
		}

		const onKey = (event: KeyboardEvent) => {
			if (event.repeat || IGNORED_KEYS.has(event.key)) {
				return;
			}

			event.preventDefault();
			onInput();
		};

		const onPointer = (event: PointerEvent) => {
			if (event.button === 0) {
				onInput();
			}
		};

		let held = anyPadButton();

		let frame = requestAnimationFrame(function poll() {
			const pressed = anyPadButton();

			if (pressed && !held) {
				onInput();

				return;
			}

			held = pressed;
			frame = requestAnimationFrame(poll);
		});

		window.addEventListener("keydown", onKey);
		window.addEventListener("pointerdown", onPointer);

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("pointerdown", onPointer);
		};
	}, [armed, onInput]);
}

function confirmAndEnter(): void {
	void audioEngine.resume().then(() => playUiClick("confirm"));
	enterMenu();
}

export function TitleScreen() {
	const t = useT();
	const phase = useStore(titleStore, (state) => state.phase);
	const [booted, setBooted] = useState(false);

	useEffect(() => whenBooted(() => setBooted(true)), []);
	useAnyInput(confirmAndEnter, phase === "title" && booted);

	if (phase !== "title" || !booted) {
		return null;
	}

	return (
		<div className={styles.title}>
			<div className={styles.logo}>
				<h1 className={styles.name}>Moldius</h1>
				<p className={styles.tagline}>{t.title.tagline}</p>
			</div>
			<p className={styles.prompt} role="status">
				{t.title.pressAnyKey}
			</p>
			<p className={styles.copyright}>
				{t.title.copyright(COPYRIGHT_YEAR, STUDIO_NAME)}
			</p>
		</div>
	);
}
