import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { photoFileName, photoStore } from "../photos/photoStore";
import styles from "./ResultsScreen.module.scss";

function download(url: string, name: string): void {
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
}

/** Les photos de la partie, à télécharger avant d'en relancer une : elles ne sont gardées nulle part. */
export function PhotoGallery() {
	const t = useT();
	const labels = t.game.results.photos;
	const photos = useStore(photoStore, (state) => state.photos);
	if (photos.length === 0) {
		return null;
	}
	return (
		<section className={styles.photos}>
			<div className={styles.photosHead}>
				<h2>{labels.title(photos.length)}</h2>
				{photos.length > 1 ? (
					<button
						type="button"
						className={styles.link}
						onClick={() =>
							photos.forEach((photo, index) =>
								window.setTimeout(
									() => download(photo.url, photoFileName(photo, index)),
									index * 250,
								),
							)
						}
						data-selectable=""
					>
						{labels.downloadAll}
					</button>
				) : null}
			</div>
			<ul>
				{photos.map((photo, index) => (
					<li key={photo.id}>
						<a
							href={photo.url}
							download={photoFileName(photo, index)}
							title={labels.download}
							data-selectable=""
						>
							<img src={photo.url} alt={labels.alt(index + 1)} />
						</a>
					</li>
				))}
			</ul>
			<p className={styles.photosNote}>{labels.note}</p>
		</section>
	);
}
