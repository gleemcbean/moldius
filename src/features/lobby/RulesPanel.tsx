import {
	MAX_ANOMALY_COUNT,
	MAX_MATCH_MINUTES,
	MAX_UPPER_FLOORS,
	MIN_ANOMALY_COUNT,
	MIN_MATCH_MINUTES,
} from "@shared/config/index";
import { ENABLED_SPECIES_IDS } from "@shared/config/monsters";
import type { SpeciesId } from "@shared/config/species";
import { OPTIONAL_ROOM_TYPES } from "@shared/manor/roomCatalog";
import type { RoomType } from "@shared/manor/types";
import {
	MANOR_SIZES,
	type ManorSize,
	type MatchConfig,
} from "@shared/matchConfig";
import type { LobbyState } from "@shared/protocol/lobby";
import { TEAM_COUNT_CHOICES } from "@shared/teams";
import { Field, Segmented, Slider } from "../../components/Controls";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import styles from "./LobbyScreen.module.scss";
import { configDraftStore, updateLobbyConfig } from "./lobbyClient";

export function RulesPanel({
	lobby,
	editable,
}: {
	lobby: LobbyState;
	editable: boolean;
}) {
	const t = useT();
	const labels = t.lobby.rules;
	const sizeOptions = MANOR_SIZES.map((size) => ({
		value: size,
		label: t.world.manorSizes[size],
	}));
	const draft = useStore(configDraftStore, (state) => state.config);
	const config = editable && draft ? draft : lobby.config;
	const update = (patch: Partial<MatchConfig>) => {
		if (editable) {
			updateLobbyConfig({ ...config, ...patch });
		}
	};
	const toggleRoom = (type: RoomType) => {
		const enabled = config.roomTypes.includes(type);
		update({
			roomTypes: enabled
				? config.roomTypes.filter((entry) => entry !== type)
				: [...config.roomTypes, type],
		});
	};
	const toggleSpecies = (id: SpeciesId) => {
		const enabled = config.species.includes(id);
		if (enabled && config.species.length === 1) {
			return;
		}
		update({
			species: enabled
				? config.species.filter((entry) => entry !== id)
				: ENABLED_SPECIES_IDS.filter(
						(entry) => entry === id || config.species.includes(entry),
					),
		});
	};
	return (
		<aside className={styles.rules}>
			<h2 className={styles.rulesTitle}>{labels.title}</h2>
			<p className={styles.rulesNote}>
				{editable ? labels.hostNote : labels.guestNote}
			</p>
			<Field label={labels.anomalies}>
				<Slider
					value={config.anomalyCount}
					min={MIN_ANOMALY_COUNT}
					max={MAX_ANOMALY_COUNT}
					step={1}
					disabled={!editable}
					onChange={(anomalyCount) => update({ anomalyCount })}
				/>
			</Field>
			<Field label={labels.duration}>
				<Slider
					value={config.durationMinutes}
					min={MIN_MATCH_MINUTES}
					max={MAX_MATCH_MINUTES}
					step={1}
					disabled={!editable}
					format={labels.minutes}
					onChange={(durationMinutes) => update({ durationMinutes })}
				/>
			</Field>
			<Field label={labels.teams}>
				<Segmented<number>
					value={config.teamCount}
					options={TEAM_COUNT_CHOICES.map((count) => ({
						value: count,
						label: count === 0 ? labels.noTeams : String(count),
					}))}
					disabled={!editable}
					onChange={(teamCount) => update({ teamCount })}
				/>
			</Field>
			<Field label={labels.manorSize}>
				<Segmented<ManorSize>
					value={config.manorSize}
					options={sizeOptions}
					disabled={!editable}
					onChange={(manorSize) => update({ manorSize })}
				/>
			</Field>
			<Field label={labels.floors}>
				<Segmented<number>
					value={config.floors}
					options={Array.from(
						{ length: MAX_UPPER_FLOORS + 1 },
						(_, floors) => ({
							value: floors,
							label: floors === 0 ? labels.noFloor : String(floors),
						}),
					)}
					disabled={!editable}
					onChange={(floors) => update({ floors })}
				/>
			</Field>
			{config.floors > 0 ? (
				<>
					<Field label={labels.upperFloorSize}>
						<Segmented<ManorSize>
							value={config.upperFloorSize}
							options={sizeOptions}
							disabled={!editable}
							onChange={(upperFloorSize) => update({ upperFloorSize })}
						/>
					</Field>
					<Field label={labels.stairs}>
						<Segmented<1 | 2>
							value={config.stairCount}
							disabled={!editable}
							options={[
								{ value: 1, label: "1" },
								{ value: 2, label: "2" },
							]}
							onChange={(stairCount) => update({ stairCount })}
						/>
					</Field>
				</>
			) : null}
			<ChipSection
				title={labels.roomTypes}
				count={config.roomTypes.length}
				total={OPTIONAL_ROOM_TYPES.length}
				editable={editable}
				chips={OPTIONAL_ROOM_TYPES.map((type) => ({
					key: type,
					label: t.world.roomChips[type],
					enabled: config.roomTypes.includes(type),
					toggle: () => toggleRoom(type),
				}))}
			/>
			<ChipSection
				title={labels.species}
				count={config.species.length}
				total={ENABLED_SPECIES_IDS.length}
				editable={editable}
				chips={ENABLED_SPECIES_IDS.map((id) => ({
					key: id,
					label: t.grimoire.species[id].name,
					enabled: config.species.includes(id),
					toggle: () => toggleSpecies(id),
				}))}
			/>
		</aside>
	);
}

function ChipSection({
	title,
	count,
	total,
	editable,
	chips,
}: {
	title: string;
	count: number;
	total: number;
	editable: boolean;
	chips: { key: string; label: string; enabled: boolean; toggle: () => void }[];
}) {
	return (
		<details className={styles.chipSection}>
			<summary className={styles.roomTitle}>
				{title}
				<span className={styles.chipCount}>
					{count}/{total}
				</span>
			</summary>
			<div className={styles.roomChips}>
				{chips.map((chip) => (
					<button
						key={chip.key}
						type="button"
						disabled={!editable}
						className={[
							styles.roomChip,
							chip.enabled ? styles.roomChipOn : "",
						].join(" ")}
						onClick={chip.toggle}
						aria-pressed={chip.enabled}
						data-selectable=""
					>
						{chip.label}
					</button>
				))}
			</div>
		</details>
	);
}
