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
	requireLevel: (level: number) => `Atteindre le niveau ${level}`,
	requireTier: (tier: number, name: string, task: string) =>
		`Défi ${name}, palier ${tier} : ${task}`,
	guestRequirement: (requirement: string) => `${requirement} (avec un compte)`,
	resultsTitle: (names: string) => `Défis réussis : ${names}`,
	privateOff:
		"Partie privée : les défis ne progressent pas ici. Ils comptent en partie publique et au défi du jour.",
	publicOnly:
		"Les défis progressent en partie publique et au défi du jour, jamais en partie privée.",
	units: {
		meters: (value: string) => `${value} m`,
		seconds: (value: string) => `${value} s`,
	},
	list: {
		firstCapture: {
			name: "Première prise",
			description: () => "Capturez une anomalie.",
		},
		firstWin: {
			name: "Première victoire",
			description: () => "Remportez une partie.",
		},
		hatTrick: {
			name: "Coup triple",
			description: (target) =>
				`Capturez ${target} anomalies d'affilée sans jamais tomber entre deux.`,
		},
		bigGame: {
			name: "Gros gibier",
			description: () =>
				"Capturez une anomalie redoutable : Réverbère, Doppelgänger, Colosse, Fulgurant ou Pleureuse.",
		},
		naturalist: {
			name: "Naturaliste",
			description: (target) =>
				`Capturez ${target} espèces différentes en une partie.`,
		},
		buzzer: {
			name: "Sur le fil",
			description: () => "Capturez une anomalie dans la dernière minute.",
		},
		tally: {
			name: "Tableau de chasse",
			description: (target) => `Marquez ${target} points en une partie.`,
		},
		survivor: {
			name: "Survivant",
			description: () =>
				"Finissez une partie sans jamais tomber, avec au moins deux captures.",
		},
		untouchable: {
			name: "Intouchable",
			description: () =>
				"Remportez une partie sans jamais tomber, avec au moins trois captures.",
		},
		impostor: {
			name: "Imposteur",
			description: () =>
				"Remportez une partie de Possédé dans le rôle du possédé.",
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
		generous: {
			name: "Main tendue",
			description: (target) =>
				`Donnez ${target} fragments à d'autres joueurs en une partie.`,
		},
		taster: {
			name: "Goûteur",
			description: (target) =>
				`Plongez dans ${target} chaudrons de potion en une partie.`,
		},
		bountyHunter: {
			name: "Chasseur de primes",
			description: (target) =>
				`Touchez ${target} fois la prime d'un rival en une partie.`,
		},
		daredevil: {
			name: "Trompe-la-mort",
			description: (target) =>
				`Touchez à l'enjeu de ${target} salles en une partie.`,
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
		titanSlayer: {
			name: "Tombeur de titans",
			description: (target) => `Capturez ${target} anomalies redoutables.`,
		},
		survivalist: {
			name: "Increvable",
			description: (target) =>
				`Finissez ${target} parties sans tomber, avec au moins deux captures.`,
		},
		puppeteer: {
			name: "Marionnettiste",
			description: (target) =>
				`Remportez ${target} parties de Possédé dans le rôle du possédé.`,
		},
		forager: {
			name: "Cueilleur",
			description: (target) => `Ramassez ${target} fragments.`,
		},
		crafter: {
			name: "Alchimiste",
			description: (target) => `Fabriquez ${target} objets occultes.`,
		},
		benefactor: {
			name: "Bienfaiteur",
			description: (target) => `Donnez ${target} fragments à d'autres joueurs.`,
		},
		mercenary: {
			name: "Mercenaire",
			description: (target) => `Touchez ${target} primes.`,
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
	requireLevel: (level) => `Reach level ${level}`,
	requireTier: (tier, name, task) => `${name} challenge, tier ${tier}: ${task}`,
	guestRequirement: (requirement) => `${requirement} (with an account)`,
	resultsTitle: (names) => `Challenges completed: ${names}`,
	privateOff:
		"Private game: challenges do not progress here. They count in public games and in the daily challenge.",
	publicOnly:
		"Challenges progress in public games and in the daily challenge, never in private games.",
	units: {
		meters: (value) => `${value} m`,
		seconds: (value) => `${value} s`,
	},
	list: {
		firstCapture: {
			name: "First catch",
			description: () => "Capture an anomaly.",
		},
		firstWin: { name: "First win", description: () => "Win a game." },
		hatTrick: {
			name: "Hat trick",
			description: (target) =>
				`Capture ${target} anomalies in a row without going down in between.`,
		},
		bigGame: {
			name: "Big game",
			description: () =>
				"Capture a fearsome anomaly: the Gaslamp, the Doppelgänger, the Colossus, the Fulgurant or the Weeper.",
		},
		naturalist: {
			name: "Naturalist",
			description: (target) =>
				`Capture ${target} different species in one game.`,
		},
		buzzer: {
			name: "Down to the wire",
			description: () => "Capture an anomaly in the final minute.",
		},
		tally: {
			name: "Trophy board",
			description: (target) => `Score ${target} points in one game.`,
		},
		survivor: {
			name: "Survivor",
			description: () =>
				"Finish a game without ever going down, with at least two captures.",
		},
		untouchable: {
			name: "Untouchable",
			description: () =>
				"Win a game without ever going down, with at least three captures.",
		},
		impostor: {
			name: "Impostor",
			description: () => "Win a Possessed game as the possessed player.",
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
		generous: {
			name: "Helping hand",
			description: (target) =>
				`Give ${target} fragments to other players in one game.`,
		},
		taster: {
			name: "Taster",
			description: (target) =>
				`Wade into ${target} potion cauldrons in one game.`,
		},
		bountyHunter: {
			name: "Bounty hunter",
			description: (target) =>
				`Collect a rival's bounty ${target} times in one game.`,
		},
		daredevil: {
			name: "Daredevil",
			description: (target) =>
				`Touch the stake of ${target} rooms in one game.`,
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
		titanSlayer: {
			name: "Titan slayer",
			description: (target) => `Capture ${target} fearsome anomalies.`,
		},
		survivalist: {
			name: "Unbreakable",
			description: (target) =>
				`Finish ${target} games without going down, with at least two captures.`,
		},
		puppeteer: {
			name: "Puppeteer",
			description: (target) =>
				`Win ${target} Possessed games as the possessed player.`,
		},
		forager: {
			name: "Forager",
			description: (target) => `Pick up ${target} fragments.`,
		},
		crafter: {
			name: "Alchemist",
			description: (target) => `Craft ${target} occult objects.`,
		},
		benefactor: {
			name: "Benefactor",
			description: (target) => `Give ${target} fragments to other players.`,
		},
		mercenary: {
			name: "Mercenary",
			description: (target) => `Collect ${target} bounties.`,
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
