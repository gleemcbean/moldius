import { type ReactNode, useState } from "react";
import styles from "./Checkbox.module.scss";

export function Checkbox({
	checked,
	onChange,
	disabled = false,
	label,
	hint,
	icon,
	title,
	className,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	label: ReactNode;
	hint?: ReactNode;
	icon?: ReactNode;
	title?: string;
	className?: string;
}) {
	const [touched, setTouched] = useState(false);
	return (
		<label
			className={[
				styles.checkbox,
				checked ? styles.on : "",
				touched ? styles.touched : "",
				disabled ? styles.disabled : "",
				className ?? "",
			].join(" ")}
			title={title}
			data-selectable={disabled ? undefined : ""}
		>
			<input
				type="checkbox"
				className={styles.input}
				checked={checked}
				disabled={disabled}
				onChange={(event) => {
					setTouched(true);
					onChange(event.target.checked);
				}}
			/>
			<span className={styles.box} aria-hidden="true">
				<svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
					<path d="M4 12.5 9.5 18 20 6" pathLength={1} />
				</svg>
			</span>
			{icon ? <span className={styles.icon}>{icon}</span> : null}
			<span className={styles.text}>
				<strong className={styles.label}>{label}</strong>
				{hint ? <small className={styles.hint}>{hint}</small> : null}
			</span>
		</label>
	);
}
