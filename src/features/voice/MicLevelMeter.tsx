import styles from "./MicLevelMeter.module.scss";

const SEGMENTS = 28;

export function MicLevelMeter({
	level,
	label,
}: {
	level: number;
	label?: string;
}) {
	const lit = Math.round(Math.min(1, level) * SEGMENTS);
	return (
		<div
			className={styles.meter}
			role="meter"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(Math.min(1, level) * 100)}
		>
			{Array.from({ length: SEGMENTS }, (_, index) => (
				<span
					key={index.toString()}
					className={[
						styles.segment,
						index < lit
							? index >= SEGMENTS * 0.82
								? styles.hot
								: styles.lit
							: "",
					].join(" ")}
				/>
			))}
		</div>
	);
}
