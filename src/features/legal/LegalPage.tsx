import { useLanguage } from "../../i18n";
import styles from "./LegalPage.module.scss";
import type { LegalDocument, LegalLanguage } from "./legalContent";
import { legalContent } from "./legalContent";

export function LegalPage({ document }: { document: LegalDocument }) {
	const preferred = useLanguage();
	const params = new URLSearchParams(window.location.search);
	const lang: LegalLanguage =
		params.get("lang") === "en" || params.get("lang") === "fr"
			? (params.get("lang") as LegalLanguage)
			: preferred;
	const copy = legalContent[document][lang];
	const other: LegalDocument = document === "terms" ? "privacy" : "terms";
	const link = (doc: LegalDocument, language = lang) =>
		`/${doc}?lang=${language}`;

	return (
		<main className={styles.page} lang={lang}>
			<div className={styles.glow} aria-hidden="true" />
			<div className={styles.shell}>
				<nav
					className={styles.navigation}
					aria-label={lang === "fr" ? "Navigation légale" : "Legal navigation"}
				>
					<a className={styles.brand} href="/">
						MOLDIUS<span className={styles.brandMark}>✳</span>
					</a>
					<div className={styles.navLinks}>
						<a
							href={link("terms")}
							aria-current={document === "terms" ? "page" : undefined}
						>
							{lang === "fr" ? "Conditions" : "Terms"}
						</a>
						<a
							href={link("privacy")}
							aria-current={document === "privacy" ? "page" : undefined}
						>
							{lang === "fr" ? "Confidentialité" : "Privacy"}
						</a>
					</div>
					<div className={styles.language}>
						<a
							href={link(document, "fr")}
							aria-current={lang === "fr" ? "true" : undefined}
						>
							FR
						</a>
						<span>/</span>
						<a
							href={link(document, "en")}
							aria-current={lang === "en" ? "true" : undefined}
						>
							EN
						</a>
					</div>
				</nav>
				<header className={styles.hero}>
					<div className={styles.kicker}>
						<span className={styles.dot} /> {copy.eyebrow}{" "}
						<span className={styles.edition}>/ MOLDIUS</span>
					</div>
					<h1>{copy.title}</h1>
					<p className={styles.lead}>{copy.intro}</p>
					<p className={styles.date}>
						{lang === "fr" ? "Dernière mise à jour" : "Last updated"} 16.10.2026
					</p>
				</header>
				<div className={styles.content}>
					<aside
						className={styles.toc}
						aria-label={lang === "fr" ? "Sommaire" : "Contents"}
					>
						<div className={styles.tocHeading}>
							{lang === "fr" ? "SOMMAIRE" : "CONTENTS"}
						</div>
						{copy.sections.map((section, i) => (
							<a key={section.heading} href={`#section-${i + 1}`}>
								{section.heading}
							</a>
						))}
					</aside>
					<article className={styles.article}>
						{copy.sections.map((section, i) => (
							<section
								id={`section-${i + 1}`}
								key={section.heading}
								className={styles.section}
							>
								<h2>{section.heading}</h2>
								{section.paragraphs.map((paragraph) => (
									<p key={paragraph}>{paragraph}</p>
								))}
							</section>
						))}
						<div className={styles.bottomLinks}>
							<a href={link(other)}>{legalContent[other][lang].title} ↗</a>
							<a href="/">
								← {lang === "fr" ? "Retour au jeu" : "Back to game"}
							</a>
						</div>
					</article>
				</div>
				<footer className={styles.footer}>
					<span>© {new Date().getFullYear()} MOLDIUS</span>
					<span>
						{lang === "fr" ? "Un univers à explorer." : "A world to explore."}
					</span>
				</footer>
			</div>
		</main>
	);
}
