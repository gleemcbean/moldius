import {
	MATERIAL_IDS,
	type MaterialId,
	OCCULT_IDS,
	OCCULT_RECIPES,
} from "@shared/config/occult";
import { useEffect } from "react";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { leaveMatch } from "../game/matchController";
import { objectArtStore } from "../grimoire/objectArt";
import styles from "./HudParts.module.scss";
import { hudStore } from "./hudStore";

function useArt() {
	return useStore(objectArtStore, (state) => state.urls);
}

export function Inventory() {
	const t = useT();
	const inventory = useStore(hudStore, (state) => state.inventory);
	const art = useArt();
	return (
		<aside className={styles.inventory}>
			<p className={styles.inventoryTitle}>{t.game.inventory.title}</p>
			<div className={styles.inventoryGrid}>
				{MATERIAL_IDS.map((id) => {
					const count = inventory?.materials[id] ?? 0;
					return (
						<div
							key={id}
							className={count > 0 ? styles.slot : styles.slotEmpty}
							title={t.grimoire.materials[id]}
						>
							<img src={art[id]} alt={t.grimoire.materials[id]} />
							<span className={styles.slotCount}>{count}</span>
						</div>
					);
				})}
			</div>
		</aside>
	);
}

export function Hotbar() {
	const t = useT();
	const inventory = useStore(hudStore, (state) => state.inventory);
	const held = useStore(hudStore, (state) => state.heldSlot);
	const art = useArt();
	const selected = OCCULT_IDS[held];
	const owned = (inventory?.objects[selected] ?? 0) > 0;
	return (
		<div className={styles.hotbar}>
			<p className={owned ? styles.hotbarName : styles.hotbarEmpty}>
				{owned ? t.grimoire.objects[selected] : t.game.inventory.handEmpty}
			</p>
			<div className={styles.hotbarSlots}>
				{OCCULT_IDS.map((id, index) => {
					const count = inventory?.objects[id] ?? 0;
					return (
						<div
							key={id}
							className={[
								count > 0 ? styles.barSlot : styles.barSlotEmpty,
								index === held ? styles.barSlotHeld : "",
							].join(" ")}
							title={t.grimoire.objects[id]}
						>
							<span className={styles.barKey}>{index + 1}</span>
							<img src={art[id]} alt={t.grimoire.objects[id]} />
							{count > 0 ? (
								<span className={styles.slotCount}>{count}</span>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function AltarPanel() {
	const t = useT();
	const open = useStore(hudStore, (state) => state.altarOpen);
	const selected = useStore(hudStore, (state) => state.altarSelected);
	const inventory = useStore(hudStore, (state) => state.inventory);
	const art = useArt();
	if (!open) {
		return null;
	}
	const owned = (id: MaterialId) => inventory?.materials[id] ?? 0;
	return (
		<aside className={styles.altar}>
			<p className={styles.altarTitle}>{t.game.altar.title}</p>
			{OCCULT_IDS.map((object, index) => {
				const recipe = Object.entries(OCCULT_RECIPES[object]) as [
					MaterialId,
					number,
				][];
				const ready = recipe.every(([id, count]) => owned(id) >= count);
				return (
					<div
						key={object}
						className={[
							ready ? styles.altarRow : styles.altarRowOff,
							index === selected ? styles.altarRowSelected : "",
						].join(" ")}
					>
						<span className={styles.altarKey}>{index + 1}</span>
						<img className={styles.altarArt} src={art[object]} alt="" />
						<span className={styles.altarName}>
							{t.grimoire.objects[object]}
						</span>
						<span className={styles.altarRecipe}>
							{recipe.map(([id, count]) => (
								<span key={id} className={styles.altarCost}>
									<img src={art[id]} alt={t.grimoire.materials[id]} />
									{owned(id)}/{count}
								</span>
							))}
						</span>
						<span className={styles.altarOwned}>
							×{inventory?.objects[object] ?? 0}
						</span>
					</div>
				);
			})}
			<p className={styles.altarHint}>{t.game.altar.hint}</p>
		</aside>
	);
}

export function TutorialPanel() {
	const t = useT();
	const tutorial = useStore(hudStore, (state) => state.tutorial);
	const finished = tutorial?.finished ?? false;
	useEffect(() => {
		if (finished) {
			leaveMatch();
		}
	}, [finished]);
	if (!tutorial) {
		return null;
	}
	return (
		<aside className={styles.tutorial}>
			<p className={styles.tutorialStep}>
				{t.game.tutorial.progress(tutorial.index + 1, tutorial.total)}
			</p>
			<p className={styles.tutorialTitle}>{tutorial.title}</p>
			<p className={styles.tutorialBody}>{tutorial.body}</p>
			{tutorial.checks.length > 0 ? (
				<ul className={styles.tutorialChecks}>
					{tutorial.checks.map((check) => (
						<li
							key={check.label}
							className={check.ok ? styles.checkOk : styles.checkBad}
						>
							{check.ok ? "✔" : "✘"} {check.label}
						</li>
					))}
				</ul>
			) : null}
			{tutorial.arrow !== null ? (
				<p className={styles.tutorialGuide}>
					<span
						className={styles.tutorialArrow}
						style={{ transform: `rotate(${-tutorial.arrow}deg)` }}
					>
						↑
					</span>
					{tutorial.distance} m
				</p>
			) : null}
			<p className={styles.tutorialSkip}>{t.game.tutorial.skip}</p>
		</aside>
	);
}
