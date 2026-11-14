import { createStore } from "../../utils/store";

export interface VoteCandidate {
	id: string;
	name: string;
	color: number;
	self: boolean;
	voted: boolean;
}

export interface VoteState {
	open: boolean;
	endsAt: number;
	reason: "ritual" | "timeout";
	candidates: VoteCandidate[];
	choice: string | null;
}

export const voteStore = createStore<VoteState>({
	open: false,
	endsAt: 0,
	reason: "ritual",
	candidates: [],
	choice: null,
});

export function resetVote(): void {
	voteStore.replace({
		open: false,
		endsAt: 0,
		reason: "ritual",
		candidates: [],
		choice: null,
	});
}
