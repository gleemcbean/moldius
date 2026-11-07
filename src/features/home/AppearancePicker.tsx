import { HAT_PATTERNS } from "@shared/hatPatterns";
import { colorHex, PLAYER_COLOR_CHOICES } from "@shared/playerColors";
import {
	hatUnlocked,
	LANTERN_TINT_COLORS,
	LANTERN_TINTS,
	lanternUnlocked,
	type ProgressStats,
	type Reward,
	rewardFor,
} from "@shared/rewards";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { rewardRequirement } from "../challenges/rewardLabels";
import { settingsStore, updateSettings } from "../settings/settingsStore";
import styles from "./HomeScreen.module.scss";

type Category = "color" | "pattern" | "lantern";

function Trigger({
	label,
	title,
	preview,
	open,
	onClick,
}: {
	label: string;
	title: string;
	preview: ReactNode;
	open: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			title={title}
			className={[styles.trigger, open ? styles.triggerOpen : ""].join(" ")}
			aria-haspopup="true"
			aria-expanded={open}
			onClick={onClick}
			data-selectable=""
		>
			<span className={styles.triggerPreview}>{preview}</span>
			<span className={styles.triggerLabel}>{label}</span>
			<span className={styles.triggerArrow} aria-hidden="true">
				{open ? "▴" : "▾"}
			</span>
		</button>
	);
}

/** Une ligne, un bouton par catégorie : les autres choix ne s'affichent qu'à la demande. */
export function AppearancePicker({ stats }: { stats: ProgressStats | null }) {
	const t = useT();
	const color = useStore(settingsStore, (state) => state.playerColor);
	const pattern = useStore(settingsStore, (state) => state.playerPattern);
	const lantern = useStore(settingsStore, (state) => state.playerLantern);
	const [open, setOpen] = useState<Category | null>(null);
	const root = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		const onPointer = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) {
				setOpen(null);
			}
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.code === "Escape") {
				event.stopPropagation();
				setOpen(null);
			}
		};
		document.addEventListener("pointerdown", onPointer);
		window.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			window.removeEventListener("keydown", onKey, true);
		};
	}, [open]);

	const toggle = (category: Category) =>
		setOpen((current) => (current === category ? null : category));
	const choose = (patch: Parameters<typeof updateSettings>[0]) => {
		updateSettings(patch);
		setOpen(null);
	};
	const optionTitle = (
		name: string,
		unlocked: boolean,
		reward: Reward | undefined,
	) =>
		unlocked || !reward
			? name
			: `${name} : ${
					stats
						? rewardRequirement(t, reward)
						: t.challenges.guestRequirement(rewardRequirement(t, reward))
				}`;
	const lanternIcon = (tint: typeof lantern) => (
		<span
			className={[styles.swatch, styles.lanternIcon].join(" ")}
			style={{ color: `#${colorHex(LANTERN_TINT_COLORS[tint])}` }}
		>
			<Icon name="lantern" />
		</span>
	);
	const colorName = t.appearance.colors[colorHex(color)];

	return (
		<div ref={root} className={styles.appearance}>
			<div className={styles.triggers}>
				<Trigger
					label={t.home.hat}
					title={`${t.home.hatColor} : ${colorName}`}
					open={open === "color"}
					onClick={() => toggle("color")}
					preview={
						<span
							className={[styles.swatch, styles.swatchColor].join(" ")}
							style={{ background: `#${colorHex(color)}` }}
						/>
					}
				/>
				<Trigger
					label={t.home.pattern}
					title={`${t.home.hatPattern} : ${t.appearance.patterns[pattern]}`}
					open={open === "pattern"}
					onClick={() => toggle("pattern")}
					preview={
						<span className={styles.swatch}>
							<HatPreview color={color} pattern={pattern} />
						</span>
					}
				/>
				<Trigger
					label={t.home.lantern}
					title={`${t.home.lanternTint} : ${t.appearance.lanterns[lantern]}`}
					open={open === "lantern"}
					onClick={() => toggle("lantern")}
					preview={lanternIcon(lantern)}
				/>
			</div>
			{open === "color" ? (
				<div
					className={styles.options}
					role="radiogroup"
					aria-label={t.home.hatColor}
				>
					{PLAYER_COLOR_CHOICES.map((choice) => {
						const name = t.appearance.colors[colorHex(choice)];
						return (
							<button
								key={choice}
								type="button"
								role="radio"
								aria-checked={choice === color}
								aria-label={name}
								title={name}
								className={[
									styles.option,
									choice === color ? styles.optionActive : "",
								].join(" ")}
								onClick={() => choose({ playerColor: choice })}
								data-selectable=""
							>
								<span
									className={[styles.swatch, styles.swatchColor].join(" ")}
									style={{ background: `#${colorHex(choice)}` }}
								/>
							</button>
						);
					})}
				</div>
			) : null}
			{open === "pattern" ? (
				<div
					className={styles.options}
					role="radiogroup"
					aria-label={t.home.hatPattern}
				>
					{HAT_PATTERNS.map((choice) => {
						const unlocked = hatUnlocked(choice, stats);
						const name = t.appearance.patterns[choice];
						return (
							<button
								key={choice}
								type="button"
								role="radio"
								aria-checked={choice === pattern}
								aria-label={name}
								title={optionTitle(name, unlocked, rewardFor("hat", choice))}
								disabled={!unlocked}
								className={[
									styles.option,
									choice === pattern ? styles.optionActive : "",
									unlocked ? "" : styles.locked,
								].join(" ")}
								onClick={() => choose({ playerPattern: choice })}
								data-selectable=""
							>
								<span className={styles.swatch}>
									<HatPreview color={color} pattern={choice} />
								</span>
							</button>
						);
					})}
				</div>
			) : null}
			{open === "lantern" ? (
				<div
					className={styles.options}
					role="radiogroup"
					aria-label={t.home.lanternTint}
				>
					{LANTERN_TINTS.map((choice) => {
						const unlocked = lanternUnlocked(choice, stats);
						const name = t.appearance.lanterns[choice];
						return (
							<button
								key={choice}
								type="button"
								role="radio"
								aria-checked={choice === lantern}
								aria-label={name}
								title={optionTitle(
									name,
									unlocked,
									rewardFor("lantern", choice),
								)}
								disabled={!unlocked}
								className={[
									styles.option,
									choice === lantern ? styles.optionActive : "",
									unlocked ? "" : styles.locked,
								].join(" ")}
								onClick={() => choose({ playerLantern: choice })}
								data-selectable=""
							>
								{lanternIcon(choice)}
							</button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
