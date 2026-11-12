import { createStore } from "../../utils/store";

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
