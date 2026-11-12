export const discordFr = {
	title: "Discord",
	connecting: "Connexion à Discord…",
	authorizing: "Autorisez Moldius dans Discord…",
	connectedAs: (name: string) => `Connecté en tant que ${name}`,
	connectFromAccount:
		"Connectez-vous avec Discord, ou liez Discord dans « Mon compte », pour retrouver vos amis Discord ici.",
	error: "Discord est injoignable pour l'instant.",
	syncNotLinked:
		"Liez ce compte Discord à votre compte de jeu (fenêtre Compte) pour retrouver vos amis Discord.",
	syncMismatch:
		"Ce compte Discord n'est pas celui lié à votre compte de jeu : vos amis Discord ne sont pas synchronisés.",
	syncPending: (count: number) =>
		count === 0
			? "Aucun ami Discord n'a encore lié son compte Moldius."
			: `${count} ami${count > 1 ? "s" : ""} Discord dans le jeu. Les autres apparaîtront dès qu'ils se connecteront depuis l'application.`,
	section: "Sur Discord",
	sectionHint: "Amis Discord en ligne, pas encore amis dans le jeu.",
	playing: "Joue à Moldius",
	statuses: {
		online: "En ligne",
		idle: "Absent",
		dnd: "Ne pas déranger",
		offline: "Hors ligne",
	},
	invite: "Inviter",
	invited: "Invité",
	inviteFailed: "Invitation Discord impossible.",
	inviteMessage: "Viens chasser les anomalies avec moi !",
	joinBusy: "Terminez votre partie avant de rejoindre un ami.",
	presence: {
		menu: "Dans le menu",
		lobby: "Dans le lobby",
		match: "En partie",
		public: "Lobby public",
		private: "Lobby privé",
		friends: "Lobby ouvert aux amis",
		daily: "Défi du jour",
	},
};

export const discordEn: typeof discordFr = {
	title: "Discord",
	connecting: "Connecting to Discord…",
	authorizing: "Authorise Moldius in Discord…",
	connectedAs: (name: string) => `Connected as ${name}`,
	connectFromAccount:
		"Sign in with Discord, or link Discord in “My account”, to find your Discord friends here.",
	error: "Discord can't be reached right now.",
	syncNotLinked:
		"Link this Discord account to your game account (Account window) to find your Discord friends.",
	syncMismatch:
		"This Discord account isn't the one linked to your game account: your Discord friends aren't synced.",
	syncPending: (count: number) =>
		count === 0
			? "None of your Discord friends has linked a Moldius account yet."
			: `${count} Discord friend${count > 1 ? "s" : ""} in the game. Others will show up once they sign in from the app.`,
	section: "On Discord",
	sectionHint: "Discord friends online who aren't game friends yet.",
	playing: "Playing Moldius",
	statuses: {
		online: "Online",
		idle: "Idle",
		dnd: "Do not disturb",
		offline: "Offline",
	},
	invite: "Invite",
	invited: "Invited",
	inviteFailed: "Discord invite failed.",
	inviteMessage: "Come hunt anomalies with me!",
	joinBusy: "Finish your match before joining a friend.",
	presence: {
		menu: "In the menu",
		lobby: "In the lobby",
		match: "In a match",
		public: "Public lobby",
		private: "Private lobby",
		friends: "Lobby open to friends",
		daily: "Daily challenge",
	},
};
