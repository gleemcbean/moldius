import type {
	MatchBegin,
	MatchInit,
	MatchResults,
} from "@shared/protocol/game";
import type { LoadStepId } from "../../i18n/sections/game";
import { createStore } from "../../utils/store";

export interface LoadingStep {
	id: LoadStepId;
	progress: number;
}

export interface MatchState {
	init: MatchInit | null;
	begin: MatchBegin | null;
	results: MatchResults | null;
	loadingSteps: LoadingStep[];
	loaded: boolean;
	error: string | null;
}

export const matchStore = createStore<MatchState>({
	init: null,
	begin: null,
	results: null,
	loadingSteps: [],
	loaded: false,
	error: null,
});

export function resetMatchState(): void {
	matchStore.replace({
		init: null,
		begin: null,
		results: null,
		loadingSteps: [],
		loaded: false,
		error: null,
	});
}
