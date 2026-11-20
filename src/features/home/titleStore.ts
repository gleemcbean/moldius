import { createStore } from "../../utils/store";
import { inviteStore } from "../lobby/inviteStore";

export type TitlePhase = "title" | "menu";

export const titleStore = createStore<{ phase: TitlePhase }>({
	phase: inviteStore.get().code ? "menu" : "title",
});

export function enterMenu(): void {
	titleStore.set({ phase: "menu" });
}
