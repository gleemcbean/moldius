import type { DailyTheme } from "@shared/dailyChallenge";

export const dailyFr = {
	title: "Mode de jeu du jour",
	nextIn: (time: string) => `Prochain mode dans ${time}`,
	leaderboard: "Classement du jour",
	loading: "Chargement du classement…",
	empty: "Personne n'a encore joué aujourd'hui : à vous l'honneur.",
	unavailable: "Le classement n'est pas disponible pour l'instant.",
	signInHint:
		"Vous pouvez jouer sans compte, mais seuls les comptes figurent au classement.",
	play: "Jouer à ce mode",
	saved: "Votre score compte pour le classement du jour.",
	seeBoard: "Voir le classement",
	anomalies: (count: number) =>
		`${count} anomalie${count > 1 ? "s" : ""} à la fois`,
	themes: {
		siege: {
			name: "Le siège",
			description: "Un tout petit manoir, cinq anomalies : nulle part où fuir.",
		},
		labyrinth: {
			name: "Le labyrinthe",
			description:
				"Un immense manoir sur trois niveaux : ne vous y perdez pas.",
		},
		paranoia: {
			name: "Paranoïa",
			description:
				"Doubles, murmures et brume : ne croyez personne, surtout pas vos amis.",
		},
		famine: {
			name: "La disette",
			description: "Très peu de fragments : chaque objet occulte se mérite.",
		},
		giants: {
			name: "Les géants",
			description: "Seulement les pires monstres, dans un grand manoir.",
		},
		blitz: {
			name: "Le blitz",
			description: "Trois minutes, beaucoup de fragments : capturez vite.",
		},
		swarm: {
			name: "L'essaim",
			description: "Sept petites anomalies à la fois : ça grouille de partout.",
		},
	} satisfies Record<DailyTheme, { name: string; description: string }>,
};

export const dailyEn: typeof dailyFr = {
	title: "Daily game mode",
	nextIn: (time: string) => `Next mode in ${time}`,
	leaderboard: "Today's leaderboard",
	loading: "Loading the leaderboard…",
	empty: "Nobody has played yet today: you go first.",
	unavailable: "The leaderboard is not available right now.",
	signInHint: "You can play without an account, but only accounts are ranked.",
	play: "Play this mode",
	saved: "Your score counts for today's leaderboard.",
	seeBoard: "See the leaderboard",
	anomalies: (count: number) =>
		`${count} ${count > 1 ? "anomalies" : "anomaly"} at once`,
	themes: {
		siege: {
			name: "The siege",
			description: "A tiny manor, five anomalies: nowhere to run.",
		},
		labyrinth: {
			name: "The labyrinth",
			description: "A huge manor on three levels: don't get lost.",
		},
		paranoia: {
			name: "Paranoia",
			description:
				"Doppelgängers, whispers and haze: trust nobody, least of all your friends.",
		},
		famine: {
			name: "The famine",
			description: "Very few fragments: every occult object has to be earned.",
		},
		giants: {
			name: "The giants",
			description: "Only the worst monsters, in a large manor.",
		},
		blitz: {
			name: "The blitz",
			description: "Three minutes, plenty of fragments: capture fast.",
		},
		swarm: {
			name: "The swarm",
			description: "Seven small anomalies at once: they are everywhere.",
		},
	},
};
