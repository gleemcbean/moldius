import { useEffect, useState } from "react";
import { PadGlyphIcon } from "../../components/KeyText";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { settingsStore } from "../settings/settingsStore";
import { PAD_BUTTON, padFocus } from "./gamepad";
import styles from "./PadKeyboard.module.scss";
import {
	closePadKeyboard,
	eraseText,
	padKeyboardStore,
	typeText,
} from "./textEntry";

const REPEATING: ReadonlySet<number> = new Set([
	PAD_BUTTON.a,
	PAD_BUTTON.x,
	PAD_BUTTON.y,
]);

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

const LETTERS: Record<"fr" | "en", string[][]> = {
	fr: [
		["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
		["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
		["w", "x", "c", "v", "b", "n", "@", "-", "_", "."],
	],
	en: [
		["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
		["a", "s", "d", "f", "g", "h", "j", "k", "l", "@"],
		["z", "x", "c", "v", "b", "n", "m", "-", "_", "."],
	],
};

const SYMBOLS = [
	["!", "?", "#", "$", "%", "&", "*", "(", ")", "="],
	["+", "/", "\\", ":", ";", '"', "'", "<", ">", "~"],
	["é", "è", "ê", "à", "â", "ç", "ù", "ô", "î", "ë"],
];

function shown(value: string, password: boolean): string {
	return password ? "•".repeat(value.length) : value;
}

function fieldName(target: HTMLElement): string {
	const labelled = target.getAttribute("aria-label");
	if (labelled) {
		return labelled;
	}
	const label =
		target.closest("label") ??
		(target.id
			? document.querySelector<HTMLLabelElement>(`label[for="${target.id}"]`)
			: null);
	const text = label?.textContent?.trim();
	if (text) {
		return text;
	}
	return target.getAttribute("placeholder") ?? "";
}

export function PadKeyboard() {
	const t = useT();
	const labels = t.settings.controls.padKeyboard;
	const target = useStore(padKeyboardStore, (state) => state.target);
	const language = useStore(settingsStore, (state) => state.language);
	const [shift, setShift] = useState(false);
	const [symbols, setSymbols] = useState(false);
	const [value, setValue] = useState("");

	useEffect(() => {
		if (!target) {
			return;
		}
		setShift(false);
		setSymbols(false);
		setValue(target.value);
		const sync = () => setValue(target.value);
		target.addEventListener("input", sync);
		const onKey = (event: KeyboardEvent) => {
			if (event.code === "Escape") {
				event.preventDefault();
				event.stopImmediatePropagation();
				closePadKeyboard();
			}
		};
		window.addEventListener("keydown", onKey, true);
		const watch = window.setInterval(() => {
			if (!target.isConnected) {
				padKeyboardStore.set({ target: null });
			} else {
				setValue(target.value);
			}
		}, 250);
		padFocus.repeatButtons = REPEATING;
		padFocus.onButton = (button) => {
			if (button === PAD_BUTTON.x) {
				eraseText();
				return true;
			}
			if (button === PAD_BUTTON.y) {
				typeText(" ");
				return true;
			}
			if (button === PAD_BUTTON.b || button === PAD_BUTTON.start) {
				closePadKeyboard();
				return true;
			}
			return false;
		};
		return () => {
			target.removeEventListener("input", sync);
			window.removeEventListener("keydown", onKey, true);
			window.clearInterval(watch);
			padFocus.onButton = null;
			padFocus.repeatButtons = null;
		};
	}, [target]);

	if (!target) {
		return null;
	}
	const password =
		target instanceof HTMLInputElement && target.type === "password";
	const rows = symbols ? SYMBOLS : LETTERS[language === "en" ? "en" : "fr"];
	const press = (key: string) => {
		typeText(shift ? key.toUpperCase() : key);
		if (shift) {
			setShift(false);
		}
	};

	return (
		<div className={styles.layer}>
			<section
				className={styles.panel}
				aria-label={labels.title}
				data-pad-scope=""
				data-pad-priority=""
			>
				<header className={styles.preview}>
					<span className={styles.field}>{fieldName(target)}</span>
					<span className={styles.value}>
						{shown(value, password)}
						<span className={styles.caret} />
					</span>
				</header>
				<div className={styles.rows}>
					{[DIGITS, ...rows].map((row) => (
						<div key={row.join("")} className={styles.row}>
							{row.map((key, index) => (
								<button
									key={key}
									type="button"
									className={styles.key}
									onClick={() => press(key)}
									data-pad-repeat=""
									data-pad-default={
										row === rows[0] && index === 0 ? "" : undefined
									}
									data-selectable=""
								>
									{shift ? key.toUpperCase() : key}
								</button>
							))}
						</div>
					))}
					<div className={styles.row}>
						<button
							type="button"
							className={[styles.key, styles.wide, shift ? styles.on : ""].join(
								" ",
							)}
							aria-pressed={shift}
							onClick={() => setShift((on) => !on)}
							data-selectable=""
						>
							{labels.shift}
						</button>
						<button
							type="button"
							className={[styles.key, styles.wide].join(" ")}
							onClick={() => setSymbols((on) => !on)}
							data-selectable=""
						>
							{symbols ? labels.letters : labels.symbols}
						</button>
						<button
							type="button"
							className={[styles.key, styles.space].join(" ")}
							onClick={() => typeText(" ")}
							data-pad-repeat=""
							data-selectable=""
						>
							{labels.space}
						</button>
						<button
							type="button"
							className={[styles.key, styles.wide].join(" ")}
							onClick={eraseText}
							data-pad-repeat=""
							data-selectable=""
						>
							⌫
						</button>
						<button
							type="button"
							className={[styles.key, styles.wide, styles.done].join(" ")}
							onClick={closePadKeyboard}
							data-selectable=""
						>
							{labels.done}
						</button>
					</div>
				</div>
				<footer className={styles.hints}>
					<span>
						<PadGlyphIcon glyph="x" />
						{labels.erase}
					</span>
					<span>
						<PadGlyphIcon glyph="y" />
						{labels.space}
					</span>
					<span>
						<PadGlyphIcon glyph="b" />
						{labels.close}
					</span>
				</footer>
			</section>
		</div>
	);
}
