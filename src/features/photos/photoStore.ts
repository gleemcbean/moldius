import { MAX_PHOTOS_PER_MATCH } from "@shared/config/index";
import { createStore } from "../../utils/store";

export interface MatchPhoto {
	id: number;
	url: string;
	takenAt: number;
}

/** Les photos ne quittent jamais le navigateur : rien n'est envoyé au serveur. */
export const photoStore = createStore<{ photos: MatchPhoto[] }>({
	photos: [],
});

let nextId = 1;

export function addPhoto(blob: Blob): boolean {
	const { photos } = photoStore.get();
	if (photos.length >= MAX_PHOTOS_PER_MATCH) {
		return false;
	}
	photoStore.set({
		photos: [
			...photos,
			{ id: nextId++, url: URL.createObjectURL(blob), takenAt: Date.now() },
		],
	});
	return true;
}

export function clearPhotos(): void {
	for (const photo of photoStore.get().photos) {
		URL.revokeObjectURL(photo.url);
	}
	photoStore.set({ photos: [] });
}

export function photoFileName(photo: MatchPhoto, index: number): string {
	const date = new Date(photo.takenAt);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `moldius-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-photo-${index + 1}.jpg`;
}
