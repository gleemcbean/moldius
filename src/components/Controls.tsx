import { createContext, type ReactNode, useContext, useId } from "react";
import { useT } from "../i18n";
import styles from "./Controls.module.scss";

const FieldLabel = createContext<string | undefined>(undefined);

export function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: ReactNode;
	children: ReactNode;
}) {
	const labelId = useId();
	return (
		<fieldset className={styles.field} aria-labelledby={labelId}>
			<span id={labelId} className={styles.fieldLabel}>
				{label}
			</span>
			<span className={styles.fieldControl}>
				<FieldLabel value={labelId}>{children}</FieldLabel>
			</span>
			{hint ? <span className={styles.fieldHint}>{hint}</span> : null}
		</fieldset>
	);
}

export interface SliderProps {
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
	format?: (value: number) => string;
	disabled?: boolean;
}

export function Slider({
	value,
	min,
	max,
	step,
	onChange,
	format,
	disabled,
}: SliderProps) {
	const labelledBy = useContext(FieldLabel);
	const percent = ((value - min) / (max - min)) * 100;
	return (
		<span className={styles.slider}>
			<input
				type="range"
				aria-labelledby={labelledBy}
				min={min}
				max={max}
				step={step}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(Number(event.target.value))}
				style={{ ["--fill" as string]: `${percent}%` }}
				data-selectable=""
			/>
			<span className={styles.sliderValue}>
				{format ? format(value) : value}
			</span>
		</span>
	);
}

export function Toggle({
	checked,
	onChange,
	disabled,
	label,
}: {
	checked: boolean;
	onChange: (value: boolean) => void;
	disabled?: boolean;
	label?: string;
}) {
	const t = useT();
	const labelledBy = useContext(FieldLabel);
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			aria-labelledby={label ? undefined : labelledBy}
			disabled={disabled}
			className={[styles.toggle, checked ? styles.toggleOn : ""].join(" ")}
			onClick={() => onChange(!checked)}
			data-selectable=""
		>
			<span className={styles.toggleKnob} />
			<span className={styles.toggleText}>
				{checked ? t.common.yes : t.common.no}
			</span>
		</button>
	);
}

export interface SegmentedOption<T extends string | number> {
	value: T;
	label: string;
}

export function Segmented<T extends string | number>({
	value,
	options,
	onChange,
	disabled,
}: {
	value: T;
	options: SegmentedOption<T>[];
	onChange: (value: T) => void;
	disabled?: boolean;
}) {
	const labelledBy = useContext(FieldLabel);
	return (
		<span
			className={styles.segmented}
			role="radiogroup"
			aria-labelledby={labelledBy}
		>
			{options.map((option) => (
				<button
					key={String(option.value)}
					type="button"
					role="radio"
					aria-checked={option.value === value}
					disabled={disabled}
					className={[
						styles.segment,
						option.value === value ? styles.segmentActive : "",
					].join(" ")}
					onClick={() => onChange(option.value)}
					data-selectable=""
				>
					{option.label}
				</button>
			))}
		</span>
	);
}

const METER_TONES = {
	yellow: styles.meterYellow,
	red: styles.meterRed,
	blue: styles.meterBlue,
	green: styles.meterGreen,
};

export function Meter({
	value,
	max = 100,
	tone = "yellow",
	label,
}: {
	value: number;
	max?: number;
	tone?: "yellow" | "red" | "blue" | "green";
	label?: string;
}) {
	const percent = Math.max(0, Math.min(100, (value / max) * 100));
	return (
		<span
			className={[styles.meter, METER_TONES[tone]].join(" ")}
			role="meter"
			aria-valuenow={Math.round(value)}
			aria-valuemin={0}
			aria-valuemax={max}
			aria-label={label}
		>
			<span className={styles.meterFill} style={{ width: `${percent}%` }} />
		</span>
	);
}
