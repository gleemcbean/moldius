import { settingsStore } from "../features/settings/settingsStore";
import { useStore } from "../hooks/useStore";
import type { Language } from "./language";
import { accountEn, accountFr } from "./sections/account";
import { bestiaryEn, bestiaryFr } from "./sections/bestiary";
import { challengesEn, challengesFr } from "./sections/challenges";
import { commonEn, commonFr } from "./sections/common";
import { dailyEn, dailyFr } from "./sections/daily";
import { friendsEn, friendsFr } from "./sections/friends";
import { gameEn, gameFr } from "./sections/game";
import { grimoireEn, grimoireFr } from "./sections/grimoire";
import { appearanceEn, appearanceFr, homeEn, homeFr } from "./sections/home";
import { lobbyEn, lobbyFr } from "./sections/lobby";
import { progressionEn, progressionFr } from "./sections/progression";
import { settingsEn, settingsFr } from "./sections/settings";
import { worldEn, worldFr } from "./sections/world";

const fr = {
	common: commonFr,
	home: homeFr,
	daily: dailyFr,
	challenges: challengesFr,
	appearance: appearanceFr,
	lobby: lobbyFr,
	settings: settingsFr,
	account: accountFr,
	friends: friendsFr,
	game: gameFr,
	grimoire: grimoireFr,
	bestiary: bestiaryFr,
	world: worldFr,
	progression: progressionFr,
};

export type Messages = typeof fr;

const en: Messages = {
	common: commonEn,
	home: homeEn,
	daily: dailyEn,
	challenges: challengesEn,
	appearance: appearanceEn,
	lobby: lobbyEn,
	settings: settingsEn,
	account: accountEn,
	friends: friendsEn,
	game: gameEn,
	grimoire: grimoireEn,
	bestiary: bestiaryEn,
	world: worldEn,
	progression: progressionEn,
};

const MESSAGES: Record<Language, Messages> = { fr, en };

export function messagesFor(language: Language): Messages {
	return MESSAGES[language];
}

export function currentLanguage(): Language {
	return settingsStore.get().language;
}

export function currentMessages(): Messages {
	return MESSAGES[currentLanguage()];
}

export function useLanguage(): Language {
	return useStore(settingsStore, (state) => state.language);
}

export function useT(): Messages {
	return MESSAGES[useLanguage()];
}

export function initLanguage(): () => void {
	const apply = () => {
		const language = currentLanguage();
		document.documentElement.lang = language;
		document.title = MESSAGES[language].common.documentTitle;
	};
	apply();
	return settingsStore.subscribe((state, previous) => {
		if (state.language !== previous.language) {
			apply();
		}
	});
}
