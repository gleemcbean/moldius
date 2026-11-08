const LONG_DATE: Intl.DateTimeFormatOptions = {
	day: "numeric",
	month: "long",
	year: "numeric",
};

const SHORT_DATE: Intl.DateTimeFormatOptions = {
	day: "numeric",
	month: "short",
};

export const progressionFr = {
	level: (level: number) => `Niveau ${level}`,
	levelShort: (level: number) => `Niv. ${level}`,
	xpOf: (into: string, needed: string) => `${into} / ${needed} XP`,
	xpTotal: (xp: string) => `${xp} XP au total`,
	gained: (xp: string) => `+${xp} XP`,
	levelUp: (level: number) => `Niveau ${level} atteint !`,
	breakdown: (base: number, score: number, win: number) =>
		win > 0
			? `${base} pour la partie, ${score} pour le score, ${win} pour la victoire`
			: `${base} pour la partie, ${score} pour le score`,
	nextReward: (level: number, name: string) =>
		`Prochaine récompense au niveau ${level} : ${name}`,
	allRewards: "Toutes les récompenses de niveau sont débloquées.",
	signInForXp:
		"Connectez-vous pour gagner de l'expérience et monter de niveau à chaque partie.",
	title: "Progression",
	profile: {
		title: "Profil du joueur",
		open: (name: string) => `Voir le profil de ${name}`,
		loading: "Chargement du profil…",
		notFound: "Ce profil n'existe pas ou n'est plus disponible.",
		memberSince: (date: Date) =>
			`Membre depuis le ${new Intl.DateTimeFormat("fr-FR", LONG_DATE).format(date)}`,
		games: "Parties",
		wins: "Victoires",
		best: "Meilleur score",
		captures: "Captures",
		recent: "Dernières parties",
		noRecent: "Aucune partie jouée pour l'instant.",
		date: (date: Date) =>
			new Intl.DateTimeFormat("fr-FR", SHORT_DATE).format(date),
		rank: (rank: number, count: number) => `${rank}ᵉ sur ${count}`,
		won: "Victoire",
		daily: "Mode du jour",
		guest: "Invité, sans profil",
		private: "Profil privé",
		privateNote:
			"Ce joueur réserve ses statistiques et ses dernières parties à ses amis.",
		privateShared: "Privé : visible par ses seuls amis",
	},
};

export const progressionEn: typeof progressionFr = {
	level: (level) => `Level ${level}`,
	levelShort: (level) => `Lv ${level}`,
	xpOf: (into, needed) => `${into} / ${needed} XP`,
	xpTotal: (xp) => `${xp} XP in total`,
	gained: (xp) => `+${xp} XP`,
	levelUp: (level) => `Level ${level} reached!`,
	breakdown: (base, score, win) =>
		win > 0
			? `${base} for playing, ${score} for your score, ${win} for the win`
			: `${base} for playing, ${score} for your score`,
	nextReward: (level, name) => `Next reward at level ${level}: ${name}`,
	allRewards: "Every level reward is unlocked.",
	signInForXp: "Sign in to earn experience and level up with every game.",
	title: "Progress",
	profile: {
		title: "Player profile",
		open: (name) => `View ${name}'s profile`,
		loading: "Loading profile…",
		notFound: "This profile does not exist or is no longer available.",
		memberSince: (date) =>
			`Member since ${new Intl.DateTimeFormat("en-GB", LONG_DATE).format(date)}`,
		games: "Games",
		wins: "Wins",
		best: "Best score",
		captures: "Captures",
		recent: "Recent games",
		noRecent: "No games played yet.",
		date: (date) => new Intl.DateTimeFormat("en-GB", SHORT_DATE).format(date),
		rank: (rank, count) => `${rank} of ${count}`,
		won: "Win",
		daily: "Daily mode",
		guest: "Guest, no profile",
		private: "Private profile",
		privateNote: "This player keeps their stats and recent games for friends.",
		privateShared: "Private: visible to friends only",
	},
};
