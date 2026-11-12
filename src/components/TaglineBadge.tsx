import type { Tagline } from "@shared/rewards";
import { useT } from "../i18n";
import styles from "./TaglineBadge.module.scss";

export function TaglineBadge({
	tagline,
	chip = false,
	className,
}: {
	tagline: Tagline | null | undefined;
	chip?: boolean;
	className?: string;
}) {
	const t = useT();
	if (!tagline) {
		return null;
	}
	const text = t.appearance.taglines[tagline];
	return (
		<span
			className={[styles.tagline, chip ? styles.chip : "", className ?? ""]
				.filter(Boolean)
				.join(" ")}
			title={chip ? undefined : `${t.home.tagline} : ${text}`}
		>
			{text}
		</span>
	);
}
