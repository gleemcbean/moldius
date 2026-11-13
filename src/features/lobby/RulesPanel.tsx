import {
	MAX_ITEMS_PER_PLAYER,
	MAX_MATCH_MINUTES,
	MAX_SIMULTANEOUS_ANOMALIES,
	MAX_UPPER_FLOORS,
	MIN_ITEMS_PER_PLAYER,
	MIN_MATCH_MINUTES,
	MIN_SIMULTANEOUS_ANOMALIES,
	PACT_HEALTH_COST,
	RELIQUARY_FRAGMENTS,
	SANCTUARY_DURATION_MS,
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
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/Button";
import { Field, Segmented, Slider, Toggle } from "../../components/Controls";
import { Modal } from "../../components/Modal";
import { useStore } from "../../hooks/useStore";
import { type Messages, useT } from "../../i18n";
import styles from "./LobbyScreen.module.scss";
import { configDraftStore, updateLobbyConfig } from "./lobbyClient";

function useRulesConfig(lobby: LobbyState, editable: boolean): MatchConfig {
	const draft = useStore(configDraftStore, (state) => state.config);
	return editable && draft ? draft : lobby.config;
}

export function RulesSummary({
	lobby,
	editable,
	onOpen,
}: {
	lobby: LobbyState;
	editable: boolean;
	onOpen: () => void;
}) {
	const t = useT();
	const labels = t.lobby.rules;
	const config = useRulesConfig(lobby, editable);
	const rows = [
		{ label: labels.anomalies, value: String(config.simultaneousAnomalies) },
		{ label: labels.itemsPerPlayer, value: String(config.itemsPerPlayer) },
		{ label: labels.duration, value: labels.minutes(config.durationMinutes) },
		{
			label: labels.teams,
			value: config.teamCount === 0 ? labels.noTeams : String(config.teamCount),
		},
		{
			label: labels.manor,
			value: `${t.world.manorSizes[config.manorSize]}, ${labels.floorCount(config.floors)}`,
		},
		{
			label: labels.walkies,
			value: config.walkies ? t.common.yes : t.common.no,
		},
	];
	return (
		<section className={[styles.card, styles.rules].join(" ")}>
			<h2 className={styles.cardTitle}>{labels.title}</h2>
			<dl className={styles.rulesList}>
				{rows.map((row) => (
					<div key={row.label} className={styles.rulesRow}>
						<dt>{row.label}</dt>
						<dd>{row.value}</dd>
					</div>
				))}
			</dl>
			<Button variant="secondary" size="small" wide onClick={onOpen}>
				{editable ? labels.edit : labels.view}
			</Button>
		</section>
	);
}

export function RulesModal({
	lobby,
	editable,
	onClose,
}: {
	lobby: LobbyState;
	editable: boolean;
	onClose: () => void;
}) {
	const t = useT();
	const labels = t.lobby.rules;
	const sizeOptions = MANOR_SIZES.map((size) => ({
		value: size,
		label: t.world.manorSizes[size],
	}));
	const config = useRulesConfig(lobby, editable);
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
		<Modal title={labels.title} onClose={onClose} wide>
			<p className={styles.rulesNote}>
				{lobby.daily
					? labels.dailyNote
					: editable
						? labels.hostNote
						: labels.guestNote}
			</p>
			<div className={styles.rulesGroups}>
				<section>
					<h3 className={styles.rulesGroupTitle}>{labels.groupMatch}</h3>
					<Field label={labels.anomalies}>
						<Slider
							value={config.simultaneousAnomalies}
							min={MIN_SIMULTANEOUS_ANOMALIES}
							max={MAX_SIMULTANEOUS_ANOMALIES}
							step={1}
							disabled={!editable}
							onChange={(simultaneousAnomalies) =>
								update({ simultaneousAnomalies })
							}
						/>
					</Field>
					<Field label={labels.itemsPerPlayer} hint={labels.itemsPerPlayerHint}>
						<Slider
							value={config.itemsPerPlayer}
							min={MIN_ITEMS_PER_PLAYER}
							max={MAX_ITEMS_PER_PLAYER}
							step={1}
							disabled={!editable}
							onChange={(itemsPerPlayer) => update({ itemsPerPlayer })}
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
					<Field label={labels.walkies} hint={labels.walkiesHint}>
						<Toggle
							checked={config.walkies}
							disabled={!editable}
							onChange={(walkies) => update({ walkies })}
						/>
					</Field>
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
				</section>
				<section>
					<h3 className={styles.rulesGroupTitle}>{labels.groupManor}</h3>
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
							hint: stakeHint(type, labels.stakeHints),
							toggle: () => toggleRoom(type),
						}))}
					/>
				</section>
			</div>
			<div className={styles.rulesActions}>
				<Button onClick={onClose}>{t.common.close}</Button>
			</div>
		</Modal>
	);
}

function stakeHint(
	type: RoomType,
	hints: Messages["lobby"]["rules"]["stakeHints"],
): string | undefined {
	switch (type) {
		case "sanctuary":
			return hints.sanctuary(SANCTUARY_DURATION_MS / 1000);
		case "reliquary":
			return hints.reliquary(RELIQUARY_FRAGMENTS);
		case "pact":
			return hints.pact(PACT_HEALTH_COST);
		default:
			return undefined;
	}
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
	chips: {
		key: string;
		label: string;
		enabled: boolean;
		hint?: string;
		toggle: () => void;
	}[];
}) {
	const [tip, setTip] = useState<{
		text: string;
		x: number;
		y: number;
	} | null>(null);
	const showTip = (element: HTMLElement, text: string | undefined) => {
		if (text) {
			const box = element.getBoundingClientRect();
			setTip({ text, x: box.left + box.width / 2, y: box.top });
		}
	};
	return (
		<div className={styles.chipSection}>
			<p className={styles.roomTitle}>
				{title}
				<span className={styles.chipCount}>
					{count}/{total}
				</span>
			</p>
			<div className={styles.roomChips}>
				{chips.map((chip) => (
					<span
						key={chip.key}
						className={styles.roomChipAnchor}
						onPointerEnter={(event) => showTip(event.currentTarget, chip.hint)}
						onPointerLeave={() => setTip(null)}
						onFocus={(event) => showTip(event.currentTarget, chip.hint)}
						onBlur={() => setTip(null)}
					>
						<button
							type="button"
							disabled={!editable}
							className={[
								styles.roomChip,
								chip.enabled ? styles.roomChipOn : "",
							].join(" ")}
							onClick={chip.toggle}
							aria-pressed={chip.enabled}
							aria-description={chip.hint}
							data-selectable=""
						>
							{chip.label}
						</button>
					</span>
				))}
			</div>
			{tip
				? createPortal(
						<span
							role="tooltip"
							className={styles.roomChipTip}
							style={{ left: tip.x, top: tip.y }}
						>
							{tip.text}
						</span>,
						document.body,
					)
				: null}
		</div>
	);
}
