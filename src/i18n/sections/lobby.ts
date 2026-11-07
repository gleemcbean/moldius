import type { LobbyErrorCode } from "@shared/protocol/lobby";

export const lobbyFr = {
	connecting: "Connexion au lobby…",
	termsNotice: {
		title: "Conditions d'utilisation",
		question:
			"Avez-vous bien lu et accepté les conditions d'utilisation ? Il faut les accepter pour jouer. Sinon, quittez le lobby.",
		recording:
			"Elles prévoient notamment l'enregistrement de votre micro pendant les parties : le Doppelgänger, un monstre qui imite les joueurs, rejoue de courts extraits de votre voix aux autres joueurs, et les meilleurs moments de fin de partie font entendre votre voix.",
		deletion:
			"À la fin de chaque partie, une fois les meilleurs moments terminés, tous les extraits sont supprimés. Ils ne sont ni envoyés au serveur du jeu ni sauvegardés.",
		terms: "Lire les conditions d'utilisation",
		failed:
			"Votre acceptation n'a pas pu être enregistrée sur votre compte. Réessayez.",
		accept: "J'ai lu et j'accepte",
		leave: "Quitter",
	},
	kickerPrivate: "Lobby privé",
	kickerPublic: "Lobby public",
	title: "Antichambre du manoir",
	playerCount: (count: number, capacity: number) =>
		`${count} / ${capacity} joueurs`,
	copyCode: "Copier le lien d'invitation",
	codeLabel: "Code à partager",
	publicNote: (minPlayers: number) =>
		`Les joueurs sont répartis au hasard. La partie démarre quand tout le monde est prêt${minPlayers > 1 ? `, à partir de ${minPlayers} joueurs` : ""}.`,
	you: "vous",
	host: "Hôte",
	micOn: "Micro actif",
	micOff: "Micro absent",
	disconnected: "Déconnecté",
	ready: "Prêt",
	waiting: "En attente",
	freeSlot: "Place libre",
	freeSlotHint: "En attente d'un champignon",
	voice: {
		connecting: "Voix : connexion…",
		connected: "Voix reliée",
		interrupted: "Voix interrompue",
		unavailable: "Voix indisponible",
	},
	countdown: (seconds: number) => `Départ dans ${seconds} s`,
	leave: "Quitter",
	settings: "Paramètres",
	inMatch: "Partie en cours…",
	needPlayers: (min: number, count: number) =>
		`En attente d'au moins ${min} joueurs connectés (${count}/${min}) pour lancer la partie.`,
	readyButton: "Prêt",
	notReadyButton: "Pas prêt",
	micRequiredTitle: "Un microphone opérationnel est nécessaire",
	start: "Lancer la partie",
	micWarning:
		"Le microphone est indispensable pour jouer : il sert aux incantations, au tchat de proximité et à la détection par les anomalies.",
	rules: {
		title: "Règles de la partie",
		edit: "Modifier les règles",
		view: "Voir les règles",
		groupMatch: "La partie",
		groupManor: "Le manoir",
		manor: "Manoir",
		floorCount: (floors: number) =>
			floors === 0
				? "sans étage"
				: floors === 1
					? "1 étage"
					: `${floors} étages`,
		hostNote: "Vous êtes l'hôte : réglez la partie pour votre groupe.",
		guestNote: "Seul l'hôte peut modifier ces règles.",
		dailyNote: "Mêmes règles et même manoir pour tout le monde aujourd'hui.",
		anomalies: "Anomalies en simultané",
		walkies: "Talkies-walkies",
		walkiesHint:
			"Quelques talkies à trouver dans le manoir pour se parler à distance.",
		stakeHints: {
			sanctuary: (seconds: number) =>
				`Enjeu : soigne toute la salle pendant ${seconds} s, mais attire les anomalies.`,
			reliquary: (fragments: number) =>
				`Enjeu : ${fragments} fragments à prendre, mais l'alarme sonne et les portes claquent.`,
			pact: (health: number) => `Enjeu : un objet occulte contre ${health} PV.`,
		},
		itemsPerPlayer: "Morceaux d'objets par joueur",
		itemsPerPlayerHint:
			"Nombre de matériaux par joueur dans un manoir moyen à un étage. Il augmente ou diminue avec la taille du manoir et le nombre d'étages.",
		duration: "Durée de la partie",
		minutes: (value: number) => `${value} min`,
		manorSize: "Taille du manoir",
		floors: "Étages",
		noFloor: "Aucun",
		upperFloorSize: "Taille des étages",
		stairs: "Escaliers",
		roomTypes: "Types de salles accessibles",
		species: "Anomalies possibles",
		teams: "Équipes",
		noTeams: "Chacun pour soi",
	},
	team: "Votre équipe",
	mic: {
		title: "Microphone",
		retry: "Réessayer",
		meter: "Niveau du microphone",
		hint: "Parlez pour tester : vos coéquipiers vous entendent déjà.",
		speechAvailable: "Reconnaissance vocale disponible.",
		speechOffline:
			"Reconnaissance vocale hors ligne (Vosk) : son modèle se télécharge une fois, pendant l'attente.",
		speechMissing:
			"Reconnaissance vocale absente : incantez avec Chrome, Edge ou Safari.",
	},
	errors: {
		"invalid-name": "Choisissez un pseudonyme de 2 à 18 caractères.",
		"not-found": "Aucun lobby ne correspond à ce code.",
		full: "Ce lobby est complet.",
		"in-progress": "Une partie est déjà en cours dans ce lobby.",
		"not-host": "Seul l'hôte peut faire cela.",
		"not-private": "Les règles d'un lobby public ne sont pas modifiables.",
		"not-ready": "Tous les joueurs doivent être prêts avec un micro actif.",
		"not-enough-players":
			"Il faut au moins deux joueurs pour lancer une partie.",
		"microphone-required":
			"Activez votre microphone avant de vous déclarer prêt.",
		"rate-limited": "Trop de requêtes, patientez un instant.",
		"already-playing":
			"Ce compte est déjà dans une partie, dans un autre onglet ou une autre fenêtre.",
		"invalid-request": "Requête invalide : rechargez la page.",
		"sign-in-required": "Connectez-vous à un compte pour utiliser les amis.",
		"friend-not-found": "Aucun joueur ne correspond à ce code ami.",
		"friend-self": "C'est votre propre code ami.",
		"friend-exists": "Ce joueur est déjà ami ou a déjà reçu votre demande.",
		"friend-limit": "Votre liste d'amis est pleine.",
		"friend-offline": "Cet ami n'est pas en ligne.",
		"friend-busy": "Cet ami est déjà en partie ou dans ce lobby.",
		"lobby-not-invitable": "Rejoignez un lobby en attente pour inviter un ami.",
	} satisfies Record<LobbyErrorCode, string>,
};

export const lobbyEn: typeof lobbyFr = {
	connecting: "Joining the lobby…",
	termsNotice: {
		title: "Terms of Service",
		question:
			"Have you read and accepted the Terms of Service? You must accept them to play. Otherwise, leave the lobby.",
		recording:
			"They include recording your microphone during matches: the Doppelgänger, a monster that imitates players, plays short clips of your voice to other players, and the best moments at the end of a match let everyone hear your voice.",
		deletion:
			"At the end of every match, once the best moments are over, all clips are deleted. They are neither sent to the game server nor saved.",
		terms: "Read the Terms of Service",
		failed:
			"Your acceptance could not be saved to your account. Please try again.",
		accept: "I have read and accept",
		leave: "Leave",
	},
	kickerPrivate: "Private lobby",
	kickerPublic: "Public lobby",
	title: "Manor antechamber",
	playerCount: (count: number, capacity: number) =>
		`${count} / ${capacity} players`,
	copyCode: "Copy the invite link",
	codeLabel: "Code to share",
	publicNote: (minPlayers: number) =>
		`Players are matched at random. The game starts once everyone is ready${minPlayers > 1 ? `, with at least ${minPlayers} players` : ""}.`,
	you: "you",
	host: "Host",
	micOn: "Mic on",
	micOff: "No mic",
	disconnected: "Disconnected",
	ready: "Ready",
	waiting: "Waiting",
	freeSlot: "Free slot",
	freeSlotHint: "Waiting for a mushroom",
	voice: {
		connecting: "Voice: connecting…",
		connected: "Voice linked",
		interrupted: "Voice interrupted",
		unavailable: "Voice unavailable",
	},
	countdown: (seconds: number) => `Starting in ${seconds} s`,
	leave: "Leave",
	settings: "Settings",
	inMatch: "Game in progress…",
	needPlayers: (min: number, count: number) =>
		`Waiting for at least ${min} connected players (${count}/${min}) to start the game.`,
	readyButton: "Ready",
	notReadyButton: "Not ready",
	micRequiredTitle: "A working microphone is required",
	start: "Start the game",
	micWarning:
		"A microphone is required to play: it is used for incantations, proximity chat and by the anomalies to hear you.",
	rules: {
		title: "Game rules",
		edit: "Edit the rules",
		view: "View the rules",
		groupMatch: "The game",
		groupManor: "The manor",
		manor: "Manor",
		floorCount: (floors: number) =>
			floors === 0
				? "no upper floor"
				: floors === 1
					? "1 upper floor"
					: `${floors} upper floors`,
		hostNote: "You are the host: set up the game for your group.",
		guestNote: "Only the host can change these rules.",
		dailyNote: "Same rules and same manor for everyone today.",
		anomalies: "Simultaneous anomalies",
		walkies: "Walkie-talkies",
		walkiesHint:
			"A few walkie-talkies to find in the manor, to talk at a distance.",
		stakeHints: {
			sanctuary: (seconds: number) =>
				`At stake: heals the whole room for ${seconds} s, but draws the anomalies.`,
			reliquary: (fragments: number) =>
				`At stake: ${fragments} fragments to grab, but the alarm rings and the doors slam.`,
			pact: (health: number) => `At stake: an occult object for ${health} HP.`,
		},
		itemsPerPlayer: "Object pieces per player",
		itemsPerPlayerHint:
			"How many materials each player gets in a medium manor with one upper floor. It goes up or down with the manor size and number of floors.",
		duration: "Match length",
		minutes: (value: number) => `${value} min`,
		manorSize: "Manor size",
		floors: "Upper floors",
		noFloor: "None",
		upperFloorSize: "Upper floor size",
		stairs: "Staircases",
		roomTypes: "Available room types",
		species: "Possible anomalies",
		teams: "Teams",
		noTeams: "Free for all",
	},
	team: "Your team",
	mic: {
		title: "Microphone",
		retry: "Retry",
		meter: "Microphone level",
		hint: "Speak to test: your teammates can already hear you.",
		speechAvailable: "Speech recognition available.",
		speechOffline:
			"Offline speech recognition (Vosk): its model downloads once, while you wait.",
		speechMissing: "No speech recognition: cast with Chrome, Edge or Safari.",
	},
	errors: {
		"invalid-name": "Choose a name between 2 and 18 characters.",
		"not-found": "No lobby matches this code.",
		full: "This lobby is full.",
		"in-progress": "A game is already running in this lobby.",
		"not-host": "Only the host can do that.",
		"not-private": "The rules of a public lobby cannot be changed.",
		"not-ready": "Every player must be ready with a working microphone.",
		"not-enough-players": "At least two players are needed to start a game.",
		"microphone-required": "Turn on your microphone before getting ready.",
		"rate-limited": "Too many requests, please wait a moment.",
		"already-playing":
			"This account is already in a game, in another tab or window.",
		"invalid-request": "Invalid request: please reload the page.",
		"sign-in-required": "Sign in to an account to use friends.",
		"friend-not-found": "No player matches this friend code.",
		"friend-self": "This is your own friend code.",
		"friend-exists": "This player is already a friend or has your request.",
		"friend-limit": "Your friend list is full.",
		"friend-offline": "This friend is not online.",
		"friend-busy": "This friend is already in a match or in this lobby.",
		"lobby-not-invitable": "Join a waiting lobby to invite a friend.",
	},
};
