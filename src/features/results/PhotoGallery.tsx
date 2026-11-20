import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
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

export function PhotoGallery() {
	const t = useT();
	const labels = t.game.results.photos;
	const photos = useStore(photoStore, (state) => state.photos);
	const [viewing, setViewing] = useState<number | null>(null);
	const count = photos.length;

	useEffect(() => {
		if (viewing === null || count < 2) {
			return;
		}

		const onKey = (event: KeyboardEvent) => {
			const step =
				event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;

			if (step === 0) {
				return;
			}

			event.preventDefault();

			setViewing((index) =>
				index === null ? null : (index + step + count) % count,
			);
		};

		window.addEventListener("keydown", onKey);

		return () => window.removeEventListener("keydown", onKey);
	}, [viewing, count]);

	if (count === 0) {
		return null;
	}

	const shown = viewing === null ? null : photos[viewing % count];

	return (
		<>
			<section className={styles.photos}>
				<div className={styles.photosHead}>
					<h2>{labels.title(count)}</h2>
					{count > 1 ? (
						<button
							type="button"
							className={styles.link}
							onClick={() => {
								for (const [index, photo] of photos.entries()) {
									window.setTimeout(
										() => download(photo.url, photoFileName(photo, index)),
										index * 250,
									);
								}
							}}
							data-selectable=""
						>
							{labels.downloadAll}
						</button>
					) : null}
				</div>
				<ul>
					{photos.map((photo, index) => (
						<li key={photo.id}>
							<button
								type="button"
								className={styles.photoThumb}
								onClick={() => setViewing(index)}
								title={labels.enlarge}
								data-selectable=""
							>
								<img src={photo.url} alt={labels.alt(index + 1)} />
							</button>
						</li>
					))}
				</ul>
				<p className={styles.photosNote}>{labels.note}</p>
			</section>
			{shown && viewing !== null ? (
				<Modal
					title={labels.viewer(viewing + 1, count)}
					onClose={() => setViewing(null)}
					wide
				>
					<div className={styles.photoViewer}>
						<img src={shown.url} alt={labels.alt(viewing + 1)} />
						<div className={styles.photoViewerActions}>
							{count > 1 ? (
								<Button
									variant="secondary"
									onClick={() => setViewing((viewing - 1 + count) % count)}
									data-selectable=""
								>
									{labels.previous}
								</Button>
							) : null}
							<Button
								icon={<Icon name="download" />}
								onClick={() =>
									download(shown.url, photoFileName(shown, viewing))
								}
								data-selectable=""
							>
								{labels.download}
							</Button>
							{count > 1 ? (
								<Button
									variant="secondary"
									onClick={() => setViewing((viewing + 1) % count)}
									data-selectable=""
								>
									{labels.next}
								</Button>
							) : null}
						</div>
					</div>
				</Modal>
			) : null}
		</>
	);
}
