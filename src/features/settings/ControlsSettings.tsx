import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Field, Slider, Toggle } from "../../components/Controls";
import { KeyText } from "../../components/KeyText";
import { ACTION_GROUPS, keyLabel, RESERVED_CODES } from "../../config/controls";
import { PAD_MOVEMENT_ACTIONS } from "../../config/defaultKeys";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import type { ActionId } from "../../types/settings";
import {
	isBindablePadCode,
	PAD_RESERVED_BUTTONS,
	PAD_STICK_CODE,
	PadButtons,
	padFocus,
	readPad,
} from "../gamepad/gamepad";
import { rumble, rumbleSupported } from "../gamepad/rumble";
import styles from "./SettingsModal.module.scss";
import {
	bindKey,
	bindPad,
	resetControls,
	settingsStore,
	updateSettings,
} from "./settingsStore";

const PAD_CAPTURE_TIMEOUT_MS = 8000;

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
				{listening ? labels.listening : <KeyText text={keyLabel(code)} />}
			</button>
			{message ? <span className={styles.hint}>{message}</span> : null}
		</>
	);
}

function PadCapture({ action }: { action: ActionId }) {
	const t = useT();
	const labels = t.settings.controls;
	const code = useStore(settingsStore, (state) => state.padKeys[action]);
	const [listening, setListening] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const fixed = PAD_MOVEMENT_ACTIONS.has(action);

	useEffect(() => {
		if (!listening) {
			return;
		}

		padFocus.captureActive = true;

		const tracker = new PadButtons();
		const startedAt = performance.now();
		let frame = 0;
		let done = false;

		const stop = () => {
			done = true;

			setListening(false);
		};

		const tick = (now: number) => {
			if (done) {
				return;
			}

			const pad = readPad();

			const edges = pad
				? tracker.update(
						pad.buttons,
						now,
						(button) => !PAD_RESERVED_BUTTONS.has(button),
					)
				: [];

			const pressed = edges.find((edge) => edge.down);

			if (pressed) {
				stop();

				if (!isBindablePadCode(pressed.code)) {
					setMessage(labels.padReserved);

					return;
				}

				const change = bindPad(action, pressed.code);

				setMessage(
					change.swappedWith
						? labels.swapped(labels.actions[change.swappedWith])
						: null,
				);

				return;
			}

			if (now - startedAt > PAD_CAPTURE_TIMEOUT_MS) {
				stop();

				return;
			}

			frame = requestAnimationFrame(tick);
		};

		const onKey = (event: KeyboardEvent) => {
			if (event.code === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				stop();
			}
		};

		frame = requestAnimationFrame(tick);

		window.addEventListener("keydown", onKey, true);

		return () => {
			done = true;

			cancelAnimationFrame(frame);
			window.removeEventListener("keydown", onKey, true);

			padFocus.captureActive = false;
		};
	}, [listening, action, labels]);

	if (fixed) {
		return (
			<button
				type="button"
				className={[styles.keyButton, styles.padButton].join(" ")}
				disabled
			>
				<KeyText text={keyLabel(PAD_STICK_CODE)} />
			</button>
		);
	}

	return (
		<>
			<button
				type="button"
				className={[
					styles.keyButton,
					styles.padButton,
					listening ? styles.listening : "",
				].join(" ")}
				onClick={() => {
					setMessage(null);
					setListening((value) => !value);
				}}
				data-selectable=""
			>
				{listening ? (
					labels.padListening
				) : code ? (
					<KeyText text={keyLabel(code)} />
				) : (
					labels.padUnbound
				)}
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

	const padSensitivity = useStore(
		settingsStore,
		(state) => state.padSensitivity,
	);

	const padDeadzone = useStore(settingsStore, (state) => state.padDeadzone);
	const padVibration = useStore(settingsStore, (state) => state.padVibration);

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
			<h3 className={styles.section}>{labels.gamepad}</h3>
			<Field label={labels.padSensitivity}>
				<Slider
					value={padSensitivity}
					min={0.3}
					max={3}
					step={0.05}
					onChange={(value) => updateSettings({ padSensitivity: value })}
					format={(value) => `×${value.toFixed(2)}`}
				/>
			</Field>
			<Field label={labels.padDeadzone}>
				<Slider
					value={padDeadzone}
					min={0.05}
					max={0.4}
					step={0.01}
					onChange={(value) => updateSettings({ padDeadzone: value })}
					format={(value) => `${Math.round(value * 100)} %`}
				/>
			</Field>
			<Field
				label={labels.padVibration}
				hint={rumbleSupported() ? undefined : labels.padVibrationUnsupported}
			>
				<Slider
					value={padVibration}
					min={0}
					max={1}
					step={0.05}
					onChange={(value) => {
						updateSettings({ padVibration: value });
						rumble("tick", { force: true });
					}}
					format={(value) =>
						value === 0
							? labels.padVibrationOff
							: `${Math.round(value * 100)} %`
					}
				/>
			</Field>
			<p className={styles.hint}>{labels.padHint}</p>
			{ACTION_GROUPS.map((group) => (
				<div key={group.id}>
					<h3 className={styles.section}>{labels.groups[group.id]}</h3>
					{group.actions.map((action) => (
						<Field key={action} label={labels.actions[action]}>
							<KeyCapture action={action} />
							<PadCapture action={action} />
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
