import { useT } from "../i18n";
import styles from "./DesktopOnly.module.scss";

export function DesktopOnly() {
	const t = useT();
	return (
		<main className={styles.page}>
			<h1 className={styles.title}>MOLDIUS</h1>
			<h2 className={styles.heading}>{t.common.desktopOnly.title}</h2>
			<p className={styles.text}>{t.common.desktopOnly.text}</p>
			<a className={styles.link} href="/privacy">
				{t.common.desktopOnly.legal}
			</a>
		</main>
	);
}
