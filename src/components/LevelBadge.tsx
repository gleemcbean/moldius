import { useT } from "../i18n";
import styles from "./LevelBadge.module.scss";

export function LevelBadge({
	level,
	className,
}: {
	level: number | null | undefined;
	className?: string;
}) {
	const t = useT();
	if (!level) {
		return null;
	}
	return (
		<span
			className={[styles.level, className ?? ""].filter(Boolean).join(" ")}
			title={t.progression.level(level)}
		>
			{t.progression.levelShort(level)}
		</span>
	);
}
