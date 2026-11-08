import type { Tagline } from "@shared/rewards";
import { useT } from "../i18n";
import styles from "./TaglineBadge.module.scss";

/** Le titre d'un joueur, sous ou à côté de son nom ; rien s'il n'en a pas choisi. */
export function TaglineBadge({
	tagline,
	chip = false,
	className,
}: {
	tagline: Tagline | null | undefined;
	/** Un aperçu compact, pour les grilles de choix et les récompenses. */
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
