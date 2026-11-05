import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Field, Slider } from "../../components/Controls";
import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import type { VolumeSettings } from "../../types/settings";
import { MicLevelMeter } from "../voice/MicLevelMeter";
import { micManager, micStore } from "../voice/micManager";
import { speechEngine } from "../voice/speechRecognizer";
import styles from "./SettingsModal.module.scss";
import { settingsStore, updateSettings } from "./settingsStore";

export function AudioSettings() {
	const t = useT();
	const labels = t.settings.audio;
	const percent = t.common.percent;
	const volumes = useStore(
		settingsStore,
		(state) => state.volumes,
		shallowEqual,
	);
	const voiceGate = useStore(settingsStore, (state) => state.voiceGate);
	const micDeviceId = useStore(settingsStore, (state) => state.micDeviceId);
	const mic = useStore(
		micStore,
		(state) => ({
			status: state.status,
			devices: state.devices,
			level: state.level,
			deviceId: state.deviceId,
		}),
		shallowEqual,
	);

	const [test, setTest] = useState<"idle" | "recording" | "playing" | "failed">(
		"idle",
	);

	useEffect(() => {
		void micManager.refreshDevices();
		if (micStore.get().status === "idle") {
			void micManager.acquire(settingsStore.get().micDeviceId);
		}
	}, []);

	const runTest = async () => {
		const status = micStore.get().status;
		if (
			status !== "ready" &&
			status !== "silent" &&
			!(await micManager.acquire(micDeviceId))
		) {
			setTest("failed");
			return;
		}
		setTest("recording");
		const clip = await micManager.recordClip(3000);
		if (!clip) {
			setTest("failed");
			return;
		}
		setTest("playing");
		const { volumes } = settingsStore.get();
		await micManager.playClip(
			clip,
			volumes.master * Math.min(1, volumes.voice),
		);
		setTest("idle");
	};

	const setVolume = (key: keyof VolumeSettings) => (value: number) =>
		updateSettings({
			volumes: { ...settingsStore.get().volumes, [key]: value },
		});

	return (
		<div>
			<h3 className={styles.section}>{labels.volumes}</h3>
			<Field label={labels.master}>
				<Slider
					value={volumes.master}
					min={0}
					max={1}
					step={0.01}
					onChange={setVolume("master")}
					format={percent}
				/>
			</Field>
			<Field label={labels.ambience}>
				<Slider
					value={volumes.ambience}
					min={0}
					max={1}
					step={0.01}
					onChange={setVolume("ambience")}
					format={percent}
				/>
			</Field>
			<Field label={labels.music}>
				<Slider
					value={volumes.music}
					min={0}
					max={1}
					step={0.01}
					onChange={setVolume("music")}
					format={percent}
				/>
			</Field>
			<Field label={labels.effects}>
				<Slider
					value={volumes.effects}
					min={0}
					max={1}
					step={0.01}
					onChange={setVolume("effects")}
					format={percent}
				/>
			</Field>
			<Field label={labels.voice}>
				<Slider
					value={volumes.voice}
					min={0}
					max={1.5}
					step={0.01}
					onChange={setVolume("voice")}
					format={percent}
				/>
			</Field>
			<h3 className={styles.section}>{labels.microphone}</h3>
			<Field label={labels.device} hint={t.game.mic.status[mic.status]}>
				<select
					className={styles.select}
					value={micDeviceId ?? mic.deviceId ?? ""}
					onChange={(event) => {
						const deviceId = event.target.value || null;
						updateSettings({ micDeviceId: deviceId });
						void micManager.acquire(deviceId);
					}}
					data-selectable=""
				>
					<option value="">{labels.defaultDevice}</option>
					{mic.devices.map((device) => (
						<option key={device.id} value={device.id}>
							{device.label}
						</option>
					))}
				</select>
			</Field>
			<Field label={labels.inputLevel}>
				<MicLevelMeter level={mic.level} label={labels.meter} />
			</Field>
			<Field label={labels.gate}>
				<Slider
					value={voiceGate}
					min={0}
					max={0.3}
					step={0.01}
					onChange={(value) => updateSettings({ voiceGate: value })}
					format={percent}
				/>
			</Field>
			<p className={styles.hint}>
				{labels.speech}{" "}
				{
					{
						native: labels.speechAvailable,
						vosk: labels.speechOffline,
						none: labels.speechMissing,
					}[speechEngine() ?? "none"]
				}
			</p>
			<div className={styles.row}>
				<Button
					variant="secondary"
					disabled={test === "recording" || test === "playing"}
					onClick={() => void runTest()}
				>
					{test === "recording"
						? labels.testRecording
						: test === "playing"
							? labels.testPlaying
							: labels.test}
				</Button>
				{test === "failed" ? (
					<span className={styles.hint}>{labels.testFailed}</span>
				) : null}
			</div>
		</div>
	);
}
