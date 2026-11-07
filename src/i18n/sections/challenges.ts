import type { ChallengeId } from "@shared/challenges";

type ChallengeText = {
	name: string;
	description: (target: string) => string;
};

export const challengesFr = {
	title: "Défis",
	button: "Défis",
	summary: (done: number, total: number) => `${done} / ${total} réussis`,
	classic: "Défis classiques",
	classicHint: "À réussir une fois, en une seule partie.",
	incremental: "Défis incrémentaux",
	incrementalHint: "Votre total s'additionne de partie en partie.",
	signInHint:
		"Sans compte, vos défis sont oubliés à la fin de chaque partie : connectez-vous pour les conserver.",
	tier: (tier: number, total: number) => `Palier ${tier} / ${total}`,
	completed: (name: string) => `Défi réussi : ${name}`,
	reward: (name: string) => `Récompense : ${name}`,
	tierReward: (tier: number, name: string) =>
		`Récompense au palier ${tier} : ${name}`,
	requireClassic: (name: string, task: string) => `Défi ${name} : ${task}`,
	requireTier: (tier: number, name: string, task: string) =>
		`Défi ${name}, palier ${tier} : ${task}`,
	guestRequirement: (requirement: string) => `${requirement} (avec un compte)`,
	resultsTitle: (names: string) => `Défis réussis : ${names}`,
	units: {
		meters: (value: string) => `${value} m`,
		seconds: (value: string) => `${value} s`,
	},
	list: {
		firstCapture: {
			name: "Première prise",
			description: () => "Capturez une anomalie.",
		},
		hatTrick: {
			name: "Coup triple",
			description: (target) => `Capturez ${target} anomalies en une partie.`,
		},
		firstWin: {
			name: "Première victoire",
			description: () => "Remportez une partie.",
		},
		survivor: {
			name: "Survivant",
			description: () => "Finissez une partie sans jamais tomber.",
		},
		untouchable: {
			name: "Intouchable",
			description: () => "Remportez une partie sans jamais tomber.",
		},
		hermit: {
			name: "Ermite",
			description: (target) => `Restez caché ${target} s d'affilée.`,
		},
		sprinter: {
			name: "Sprinteur",
			description: (target) => `Sprintez sur ${target} m en une partie.`,
		},
		gatherer: {
			name: "Fourmi",
			description: (target) => `Ramassez ${target} fragments en une partie.`,
		},
		artisan: {
			name: "Artisan",
			description: (target) =>
				`Fabriquez ${target} objets occultes en une partie.`,
		},
		daredevil: {
			name: "Trompe-la-mort",
			description: () => "Touchez à l'enjeu d'une salle.",
		},
		prey: {
			name: "Proie",
			description: (target) =>
				`Soyez pourchassé pendant ${target} s en une partie.`,
		},
		operator: {
			name: "Standardiste",
			description: (target) =>
				`Parlez ${target} s au talkie-walkie en une partie.`,
		},
		doorman: {
			name: "Portier",
			description: (target) => `Actionnez ${target} portes en une partie.`,
		},
		bunny: {
			name: "Lapin",
			description: (target) => `Sautez ${target} fois en une partie.`,
		},
		saboteur: {
			name: "Saboteur",
			description: (target) => `Poussez ${target} fois en une partie.`,
		},
		veteran: {
			name: "Vétéran",
			description: (target) => `Terminez ${target} parties.`,
		},
		champion: {
			name: "Champion",
			description: (target) => `Remportez ${target} parties.`,
		},
		hunter: {
			name: "Chasseur",
			description: (target) => `Capturez ${target} anomalies.`,
		},
		forager: {
			name: "Cueilleur",
			description: (target) => `Ramassez ${target} fragments.`,
		},
		crafter: {
			name: "Alchimiste",
			description: (target) => `Fabriquez ${target} objets occultes.`,
		},
		runner: {
			name: "Coureur de fond",
			description: (target) => `Sprintez sur ${target} m au total.`,
		},
		ghost: {
			name: "Fantôme",
			description: (target) => `Restez caché ${target} s au total.`,
		},
		gambler: {
			name: "Parieur",
			description: (target) => `Touchez à ${target} enjeux.`,
		},
		regular: {
			name: "Habitué",
			description: (target) => `Jouez ${target} fois au mode de jeu du jour.`,
		},
	} satisfies Record<ChallengeId, ChallengeText>,
};

export const challengesEn: typeof challengesFr = {
	title: "Challenges",
	button: "Challenges",
	summary: (done, total) => `${done} / ${total} completed`,
	classic: "Classic challenges",
	classicHint: "Complete once, in a single game.",
	incremental: "Incremental challenges",
	incrementalHint: "Your total adds up from game to game.",
	signInHint:
		"Without an account, your challenges are forgotten after each game: sign in to keep them.",
	tier: (tier, total) => `Tier ${tier} / ${total}`,
	completed: (name) => `Challenge completed: ${name}`,
	reward: (name) => `Reward: ${name}`,
	tierReward: (tier, name) => `Reward at tier ${tier}: ${name}`,
	requireClassic: (name, task) => `${name} challenge: ${task}`,
	requireTier: (tier, name, task) => `${name} challenge, tier ${tier}: ${task}`,
	guestRequirement: (requirement) => `${requirement} (with an account)`,
	resultsTitle: (names) => `Challenges completed: ${names}`,
	units: {
		meters: (value) => `${value} m`,
		seconds: (value) => `${value} s`,
	},
	list: {
		firstCapture: {
			name: "First catch",
			description: () => "Capture an anomaly.",
		},
		hatTrick: {
			name: "Hat trick",
			description: (target) => `Capture ${target} anomalies in one game.`,
		},
		firstWin: { name: "First win", description: () => "Win a game." },
		survivor: {
			name: "Survivor",
			description: () => "Finish a game without ever going down.",
		},
		untouchable: {
			name: "Untouchable",
			description: () => "Win a game without ever going down.",
		},
		hermit: {
			name: "Hermit",
			description: (target) => `Stay hidden for ${target} s in a row.`,
		},
		sprinter: {
			name: "Sprinter",
			description: (target) => `Sprint ${target} m in one game.`,
		},
		gatherer: {
			name: "Busy ant",
			description: (target) => `Pick up ${target} fragments in one game.`,
		},
		artisan: {
			name: "Artisan",
			description: (target) => `Craft ${target} occult objects in one game.`,
		},
		daredevil: {
			name: "Daredevil",
			description: () => "Touch what's at stake in a room.",
		},
		prey: {
			name: "Prey",
			description: (target) => `Get chased for ${target} s in one game.`,
		},
		operator: {
			name: "Switchboard",
			description: (target) =>
				`Talk on the walkie-talkie for ${target} s in one game.`,
		},
		doorman: {
			name: "Doorman",
			description: (target) => `Operate ${target} doors in one game.`,
		},
		bunny: {
			name: "Bunny",
			description: (target) => `Jump ${target} times in one game.`,
		},
		saboteur: {
			name: "Saboteur",
			description: (target) => `Push ${target} times in one game.`,
		},
		veteran: {
			name: "Veteran",
			description: (target) => `Finish ${target} games.`,
		},
		champion: {
			name: "Champion",
			description: (target) => `Win ${target} games.`,
		},
		hunter: {
			name: "Hunter",
			description: (target) => `Capture ${target} anomalies.`,
		},
		forager: {
			name: "Forager",
			description: (target) => `Pick up ${target} fragments.`,
		},
		crafter: {
			name: "Alchemist",
			description: (target) => `Craft ${target} occult objects.`,
		},
		runner: {
			name: "Long-distance runner",
			description: (target) => `Sprint ${target} m in total.`,
		},
		ghost: {
			name: "Ghost",
			description: (target) => `Stay hidden for ${target} s in total.`,
		},
		gambler: {
			name: "Gambler",
			description: (target) => `Touch ${target} room stakes.`,
		},
		regular: {
			name: "Regular",
			description: (target) => `Play the daily game mode ${target} times.`,
		},
	},
};
