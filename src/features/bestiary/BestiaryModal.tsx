import { ENABLED_SPECIES_IDS } from "@shared/config/monsters";
import {
	SPECIES,
	type SpeciesDefinition,
	type SpeciesId,
} from "@shared/config/species";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components/Modal";
import { type Messages, useT } from "../../i18n";
import styles from "./BestiaryModal.module.scss";
import { type BestiaryArt, loadBestiaryArt } from "./bestiaryArt";

const PIP_COUNT = 5;
const PIPS = Array.from({ length: PIP_COUNT }, (_, index) => index);
const SPEED_SCALE = 9;
const SIGHT_SCALE = 16;
const HEARING_SCALE = 1.8;
const LETHAL_DAMAGE = 100;

function pips(value: number, scale: number): number {
	if (value <= 0) {
		return 0;
	}
	return Math.max(
		1,
		Math.min(PIP_COUNT, Math.round((value / scale) * PIP_COUNT)),
	);
}

function damageLabel(species: SpeciesDefinition, t: Messages): string {
	if (species.damage <= 0) {
		return t.bestiary.noDamage;
	}
	return species.damage >= LETHAL_DAMAGE
		? t.bestiary.lethal
		: String(species.damage);
}

function Gauge({ label, filled }: { label: string; filled: number }) {
	return (
		<div className={styles.fact}>
			<dt>{label}</dt>
			<dd className={styles.gauge}>
				<span className={styles.spoken}>{`${filled}/${PIP_COUNT}`}</span>
				{PIPS.map((pip) => (
					<span
						key={pip}
						aria-hidden="true"
						className={pip < filled ? styles.pipOn : styles.pip}
					/>
				))}
			</dd>
		</div>
	);
}

export function BestiaryModal({ onClose }: { onClose: () => void }) {
	const t = useT();
	const [selected, setSelected] = useState<SpeciesId>(ENABLED_SPECIES_IDS[0]);
	const [art, setArt] = useState<BestiaryArt | null>(null);
	const page = useRef<HTMLElement>(null);

	useEffect(() => {
		let alive = true;
		loadBestiaryArt()
			.then((drawn) => alive && setArt(drawn))
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		page.current?.scrollTo({ top: 0 });
	}, [selected]);

	const species = SPECIES[selected];
	const text = t.grimoire.species[selected];
	const illustration = art?.get(selected);
	const tags = [
		species.hostile ? t.bestiary.hostile : t.bestiary.peaceful,
		species.flying ? t.bestiary.flying : null,
		species.canOpenDoors ? t.bestiary.doors : null,
	].filter((tag): tag is string => tag !== null);

	return (
		<Modal title={t.bestiary.title} onClose={onClose} wide>
			<div className={styles.layout}>
				<nav className={styles.index} aria-label={t.bestiary.index}>
					{ENABLED_SPECIES_IDS.map((id) => {
						const thumbnail = art?.get(id);
						return (
							<button
								key={id}
								type="button"
								className={[
									styles.entry,
									id === selected ? styles.entryActive : "",
								].join(" ")}
								aria-pressed={id === selected}
								onClick={() => setSelected(id)}
								onFocus={() => setSelected(id)}
								data-selectable=""
							>
								<span className={styles.thumb}>
									{thumbnail ? <img src={thumbnail} alt="" /> : null}
								</span>
								<span className={styles.entryName}>
									{t.grimoire.species[id].name}
								</span>
								<span className={styles.entryPoints}>{SPECIES[id].points}</span>
							</button>
						);
					})}
				</nav>

				<article ref={page} className={styles.page} aria-live="polite">
					<header className={styles.heading}>
						<p className={styles.plate}>{t.bestiary.plate(species.page)}</p>
						<h3 className={styles.name}>{text.name}</h3>
					</header>

					<div className={styles.portrait}>
						<figure className={styles.figure}>
							{illustration ? (
								<img src={illustration} alt={text.name} />
							) : (
								<figcaption className={styles.sketching}>
									{t.bestiary.drawing}
								</figcaption>
							)}
						</figure>
						<div className={styles.sheet}>
							<p className={styles.points}>
								{t.grimoire.points(species.points)}
							</p>
							<dl className={styles.facts}>
								<div className={styles.fact}>
									<dt>{t.bestiary.damage}</dt>
									<dd className={styles.damage}>{damageLabel(species, t)}</dd>
								</div>
								<Gauge
									label={t.bestiary.speed}
									filled={pips(species.hostileSpeed, SPEED_SCALE)}
								/>
								<Gauge
									label={t.bestiary.sight}
									filled={pips(species.viewRange, SIGHT_SCALE)}
								/>
								<Gauge
									label={t.bestiary.hearing}
									filled={pips(species.hearing, HEARING_SCALE)}
								/>
							</dl>
							<ul className={styles.tags}>
								{tags.map((tag) => (
									<li key={tag}>{tag}</li>
								))}
							</ul>
						</div>
					</div>

					<section className={styles.section}>
						<h4>{t.bestiary.habits}</h4>
						<p>{text.description}</p>
					</section>
					<section className={styles.section}>
						<h4>{t.bestiary.danger}</h4>
						<p>{text.danger}</p>
					</section>
					<p className={styles.formula}>{t.bestiary.formula}</p>
				</article>
			</div>
		</Modal>
	);
}
