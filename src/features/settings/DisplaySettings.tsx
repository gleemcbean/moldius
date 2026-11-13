import { Button } from "../../components/Button";
import { Field, Segmented, Slider, Toggle } from "../../components/Controls";
import {
	COLOR_LEVELS,
	FPS_LIMITS,
	POST_EFFECT_PRESETS,
} from "../../config/graphics";
import { shallowEqual, useStore } from "../../hooks/useStore";
import { useLanguage, useT } from "../../i18n";
import { LANGUAGE_NAMES, LANGUAGES, type Language } from "../../i18n/language";
import {
	type ColorLevels,
	type GraphicsQuality,
	POST_EFFECT_IDS,
	type PostEffectId,
	type PostEffectPreset,
} from "../../types/settings";
import { accountStore } from "../account/accountStore";
import styles from "./SettingsModal.module.scss";
import {
	applyPostEffectPreset,
	matchingPostEffectPreset,
	resetAllSettings,
	setLanguage,
	setPostEffect,
	settingsStore,
	updateSettings,
} from "./settingsStore";

const MOTION_EFFECTS: ReadonlySet<PostEffectId> = new Set(["flicker", "band"]);

export function DisplaySettings() {
	const t = useT();
	const labels = t.settings.display;
	const language = useLanguage();
	const signedIn = useStore(
		accountStore,
		(state) => state.status === "signed-in",
	);
	const settings = useStore(
		settingsStore,
		(state) => ({
			fov: state.fov,
			brightness: state.brightness,
			quality: state.quality,
			shadows: state.shadows,
			renderScale: state.renderScale,
			effects: state.effects,
			postEffects: state.postEffects,
			colorLevels: state.colorLevels,
			fpsLimit: state.fpsLimit,
			headBob: state.headBob,
			reduceMotion: state.reduceMotion,
			showFps: state.showFps,
		}),
		shallowEqual,
	);
	return (
		<div>
			<h3 className={styles.section}>{t.settings.language.label}</h3>
			<Field label={t.settings.language.label} hint={t.settings.language.hint}>
				<Segmented<Language>
					value={language}
					onChange={(value) => setLanguage(value, !signedIn)}
					options={LANGUAGES.map((value) => ({
						value,
						label: LANGUAGE_NAMES[value],
					}))}
				/>
			</Field>
			<h3 className={styles.section}>{labels.view}</h3>
			<Field label={labels.fov}>
				<Slider
					value={settings.fov}
					min={60}
					max={100}
					step={1}
					onChange={(fov) => updateSettings({ fov })}
					format={(value) => `${value}°`}
				/>
			</Field>
			<Field label={labels.brightness} hint={labels.brightnessHint}>
				<Slider
					value={settings.brightness}
					min={0.6}
					max={1.6}
					step={0.05}
					onChange={(brightness) => updateSettings({ brightness })}
					format={t.common.percent}
				/>
			</Field>
			<Field label={labels.headBob}>
				<Toggle
					checked={settings.headBob}
					onChange={(headBob) => updateSettings({ headBob })}
				/>
			</Field>
			<Field label={labels.reduceMotion} hint={labels.reduceMotionHint}>
				<Toggle
					checked={settings.reduceMotion}
					onChange={(reduceMotion) => updateSettings({ reduceMotion })}
				/>
			</Field>
			<h3 className={styles.section}>{labels.imageEffects}</h3>
			<Field label={labels.effectsPreset} hint={labels.effectsPresetHint}>
				<Segmented<PostEffectPreset | "custom">
					value={matchingPostEffectPreset(settings.postEffects) ?? "custom"}
					onChange={(preset) => {
						if (preset !== "custom") {
							applyPostEffectPreset(preset);
						}
					}}
					options={(Object.keys(POST_EFFECT_PRESETS) as PostEffectPreset[]).map(
						(value) => ({ value, label: labels.effectsPresets[value] }),
					)}
				/>
			</Field>
			{POST_EFFECT_IDS.map((id) => {
				const locked = settings.reduceMotion && MOTION_EFFECTS.has(id);
				return (
					<Field
						key={id}
						label={labels.postEffects[id].label}
						hint={locked ? labels.motionLocked : labels.postEffects[id].hint}
					>
						<Slider
							value={settings.postEffects[id]}
							min={0}
							max={1}
							step={0.05}
							disabled={locked}
							onChange={(value) => setPostEffect(id, value)}
							format={t.common.percent}
						/>
					</Field>
				);
			})}
			<Field label={labels.colorLevels} hint={labels.colorLevelsHint}>
				<Segmented<ColorLevels>
					value={settings.colorLevels}
					onChange={(colorLevels) => updateSettings({ colorLevels })}
					options={COLOR_LEVELS.map((value) => ({
						value,
						label: String(value),
					}))}
				/>
			</Field>
			<h3 className={styles.section}>{labels.performance}</h3>
			<Field label={labels.quality}>
				<Segmented<GraphicsQuality>
					value={settings.quality}
					onChange={(quality) => updateSettings({ quality })}
					options={[
						{ value: "low", label: labels.qualities.low },
						{ value: "medium", label: labels.qualities.medium },
						{ value: "high", label: labels.qualities.high },
					]}
				/>
			</Field>
			<Field label={labels.shadows}>
				<Toggle
					checked={settings.shadows}
					onChange={(shadows) => updateSettings({ shadows })}
				/>
			</Field>
			<Field label={labels.renderScale}>
				<Slider
					value={settings.renderScale}
					min={0.5}
					max={1.25}
					step={0.05}
					onChange={(renderScale) => updateSettings({ renderScale })}
					format={t.common.percent}
				/>
			</Field>
			<Field label={labels.effects}>
				<Toggle
					checked={settings.effects}
					onChange={(effects) => updateSettings({ effects })}
				/>
			</Field>
			<Field label={labels.fpsLimit}>
				<Segmented<number>
					value={settings.fpsLimit}
					onChange={(fpsLimit) => updateSettings({ fpsLimit })}
					options={FPS_LIMITS.map((value) => ({
						value,
						label: value === 0 ? labels.unlimited : String(value),
					}))}
				/>
			</Field>
			<Field label={labels.showFps}>
				<Toggle
					checked={settings.showFps}
					onChange={(showFps) => updateSettings({ showFps })}
				/>
			</Field>
			<div className={styles.row}>
				<Button variant="secondary" onClick={resetAllSettings}>
					{labels.resetAll}
				</Button>
			</div>
		</div>
	);
}
