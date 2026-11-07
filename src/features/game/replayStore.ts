import type { SpeciesId } from "@shared/config/species";
import type { HighlightKind } from "@shared/protocol/game";
import { createStore } from "../../utils/store";

export interface ReplayMoment {
	kind: HighlightKind;
	name: string;
	other: string | null;
	species: SpeciesId | null;
	value: number;
	color: number;
}

export interface ReplayState {
	active: boolean;
	index: number;
	total: number;
	moment: ReplayMoment | null;
	voice: number;
}

export const replayStore = createStore<ReplayState>({
	active: false,
	index: 0,
	total: 0,
	moment: null,
	voice: 0,
});

export function resetReplay(): void {
	replayStore.replace({
		active: false,
		index: 0,
		total: 0,
		moment: null,
		voice: 0,
	});
}
