import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Field, Slider, Toggle } from "../../components/Controls";
import { ACTION_GROUPS, keyLabel, RESERVED_CODES } from "../../config/controls";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import type { ActionId } from "../../types/settings";
import styles from "./SettingsModal.module.scss";
import {
	bindKey,
	resetControls,
	settingsStore,
	updateSettings,
} from "./settingsStore";

function mouseCode(button: number): string | null {
	return button === 0
		? "MouseLeft"
		: button === 2
			? "MouseRight"
			: button === 1
				? "MouseMiddle"
				: null;
}

function KeyCapture({ action }: { action: ActionId }) {
	const t = useT();
	const labels = t.settings.controls;
	const code = useStore(settingsStore, (state) => state.keys[action]);
	const [listening, setListening] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		if (!listening) {
			return;
		}
		const assign = (next: string) => {
			setListening(false);
			if (RESERVED_CODES.has(next)) {
				setMessage(labels.reserved);
				return;
			}
			const change = bindKey(action, next);
			setMessage(
				change.swappedWith
					? labels.swapped(labels.actions[change.swappedWith])
					: null,
			);
		};
		const onKey = (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (event.code === "Escape") {
				setListening(false);
				return;
			}
			assign(event.code);
		};
		const onMouse = (event: MouseEvent) => {
			const codeName = mouseCode(event.button);
			if (codeName && codeName !== "MouseLeft") {
				event.preventDefault();
				assign(codeName);
			}
		};
		window.addEventListener("keydown", onKey, true);
		window.addEventListener("mousedown", onMouse, true);
		return () => {
			window.removeEventListener("keydown", onKey, true);
			window.removeEventListener("mousedown", onMouse, true);
		};
	}, [listening, action, labels]);

	return (
		<>
			<button
				type="button"
				className={[styles.keyButton, listening ? styles.listening : ""].join(
					" ",
				)}
				onClick={() => {
					setMessage(null);
					setListening(true);
				}}
				onContextMenu={(event) => event.preventDefault()}
				data-selectable=""
			>
				{listening ? labels.listening : keyLabel(code)}
			</button>
			{message ? <span className={styles.hint}>{message}</span> : null}
		</>
	);
}

export function ControlsSettings() {
	const t = useT();
	const labels = t.settings.controls;
	const sensitivity = useStore(
		settingsStore,
		(state) => state.mouseSensitivity,
	);
	const invertY = useStore(settingsStore, (state) => state.invertY);
	return (
		<div>
			<h3 className={styles.section}>{labels.mouse}</h3>
			<Field label={labels.sensitivity}>
				<Slider
					value={sensitivity}
					min={0.2}
					max={3}
					step={0.05}
					onChange={(value) => updateSettings({ mouseSensitivity: value })}
					format={(value) => `×${value.toFixed(2)}`}
				/>
			</Field>
			<Field label={labels.invertY}>
				<Toggle
					checked={invertY}
					onChange={(value) => updateSettings({ invertY: value })}
				/>
			</Field>
			{ACTION_GROUPS.map((group) => (
				<div key={group.id}>
					<h3 className={styles.section}>{labels.groups[group.id]}</h3>
					{group.actions.map((action) => (
						<Field key={action} label={labels.actions[action]}>
							<KeyCapture action={action} />
						</Field>
					))}
				</div>
			))}
			<p className={styles.hint}>{labels.hint}</p>
			<div className={styles.row}>
				<Button variant="secondary" onClick={resetControls}>
					{labels.reset}
				</Button>
			</div>
		</div>
	);
}
