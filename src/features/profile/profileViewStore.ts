import { createStore } from "../../utils/store";

/** Le profil ouvert par-dessus le reste : depuis un classement, un lobby ou la fin de partie. */
export const profileViewStore = createStore<{ profileId: string | null }>({
	profileId: null,
});

export function openProfile(profileId: string | null | undefined): void {
	if (profileId) {
		profileViewStore.set({ profileId });
	}
}

export function closeProfile(): void {
	profileViewStore.set({ profileId: null });
}
