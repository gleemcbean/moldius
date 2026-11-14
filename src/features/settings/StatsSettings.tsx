import { Field, Segmented, Slider, Toggle } from "../../components/Controls";
import { shallowEqual, useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import {
	STATS_METRICS,
	type StatsCorner,
	type StatsPreset,
} from "../../types/settings";
import styles from "./SettingsModal.module.scss";
import {
	applyStatsPreset,
	matchingStatsPreset,
	setStatsMetric,
	settingsStore,
	updateStats,
} from "./settingsStore";

const CORNERS: readonly StatsCorner[] = [
	"topLeft",
	"topRight",
	"bottomLeft",
	"bottomRight",
];

const PRESETS: readonly StatsPreset[] = ["off", "minimal", "network", "full"];

export function StatsSettings() {
	const t = useT();
	const labels = t.party.stats;
	const stats = useStore(settingsStore, (state) => state.stats, shallowEqual);
	const preset = matchingStatsPreset(stats);
	return (
		<div>
			<h3 className={styles.section}>{labels.section}</h3>
			<Field label={labels.preset} hint={labels.sectionHint}>
				<Segmented<StatsPreset | "custom">
					value={preset ?? "custom"}
					onChange={(value) => {
						if (value !== "custom") {
							applyStatsPreset(value);
						}
					}}
					options={PRESETS.map((value) => ({
						value,
						label: labels.presets[value],
					}))}
				/>
			</Field>
			{STATS_METRICS.map((metric) => (
				<Field
					key={metric}
					label={labels.metrics[metric]}
					hint={labels.hints[metric]}
				>
					<Toggle
						checked={stats.metrics[metric]}
						onChange={(enabled) => setStatsMetric(metric, enabled)}
					/>
				</Field>
			))}
			<Field label={labels.graph}>
				<Toggle
					checked={stats.graph}
					onChange={(graph) => updateStats({ graph })}
				/>
			</Field>
			<Field label={labels.corner}>
				<Segmented<StatsCorner>
					value={stats.corner}
					onChange={(corner) => updateStats({ corner })}
					options={CORNERS.map((value) => ({
						value,
						label: labels.corners[value],
					}))}
				/>
			</Field>
			<Field label={labels.opacity}>
				<Slider
					value={stats.opacity}
					min={0.3}
					max={1}
					step={0.05}
					onChange={(opacity) => updateStats({ opacity })}
					format={t.common.percent}
				/>
			</Field>
		</div>
	);
}
