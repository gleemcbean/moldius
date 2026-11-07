import type { DiscordOutcome } from "@shared/protocol/account";

export type AccountNoticeKey = DiscordOutcome | "emailConfirmed";

const DATE_TIME = { dateStyle: "medium", timeStyle: "short" } as const;
const LONG_DATE = { dateStyle: "long" } as const;

export const accountFr = {
	titleGuest: "Compte joueur",
	titleSignedIn: "Mon compte",
	titleReset: "Mot de passe oublié",
	loading: "Chargement…",
	disabled: "Les comptes joueurs ne sont pas activés sur ce serveur.",
	unavailable: "Le service des comptes est momentanément indisponible.",
	retry: "Réessayer",
	network: "Serveur injoignable, vérifiez votre connexion.",
	unexpected: "Réponse inattendue du serveur.",
	tabs: { login: "Connexion", register: "Créer un compte" },
	discordRegister: "Créer un compte avec Discord",
	discordLogin: "Se connecter avec Discord",
	orEmail: "ou avec une adresse e-mail",
	forgotHint:
		"Indiquez l'adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.",
	email: "Adresse e-mail",
	password: "Mot de passe",
	confirmPassword: "Confirmer le mot de passe",
	registerHint: (name: string) =>
		`Mot de passe d'au moins 10 caractères. Un e-mail de confirmation vous sera envoyé ; votre pseudonyme « ${name} », votre chapeau et votre langue seront enregistrés sur le compte.`,
	nameFirst:
		"Choisissez d'abord un pseudonyme de 2 caractères ou plus sur l'accueil.",
	passwordRequired: "Renseignez votre mot de passe.",
	createAccount: "Créer le compte",
	receiveLink: "Recevoir un lien",
	signIn: "Se connecter",
	forgot: "Mot de passe oublié ?",
	backToLogin: "Retour à la connexion",
	signedInToast: "Connexion réussie.",
	checkMailbox: "Vérifiez votre boîte mail",
	requestSent: "Demande envoyée",
	registerSent: (email: string) =>
		`Si l'adresse ${email} peut recevoir un compte, un e-mail de confirmation vient de lui être envoyé. Ouvrez le lien qu'il contient (valable 24 heures) pour activer votre compte.`,
	resetSent: (email: string) =>
		`Si un compte correspond à ${email}, un lien pour choisir un nouveau mot de passe vient d'être envoyé (valable 1 heure).`,
	spamHint: "Pensez à regarder dans les courriers indésirables.",
	guestNote: (limit: number) =>
		`Un compte conserve votre pseudonyme, votre chapeau, votre langue, vos statistiques et l'historique de vos ${limit} dernières parties. Il reste facultatif pour jouer.`,
	newPasswordTitle: "Nouveau mot de passe",
	newPassword: "Nouveau mot de passe",
	confirmNewPassword: "Confirmer le nouveau mot de passe",
	otherDevices: "Vos autres appareils seront déconnectés.",
	resetDone: "Mot de passe modifié : vous êtes connecté.",
	history: {
		loading: "Chargement de l'historique…",
		empty:
			"Aucune partie enregistrée pour l'instant. Terminez une chasse connecté pour la retrouver ici.",
		date: "Date",
		match: "Partie",
		name: "Pseudonyme",
		rank: "Place",
		points: "Points",
		captures: "Captures",
		deaths: "Morts",
		private: "Privée",
		public: "Publique",
		rankLabel: (rank: number) => (rank === 1 ? "1er" : `${rank}e`),
		limit: (limit: number) =>
			`Seules les ${limit} dernières parties sont conservées.`,
		dateTime: (date: Date) =>
			new Intl.DateTimeFormat("fr-FR", DATE_TIME).format(date),
	},
	profile: {
		displayName: "Pseudonyme en jeu",
		hint: "Le pseudonyme, le chapeau et la lanterne choisis sur l'écran d'accueil, ainsi que la langue choisie dans les paramètres, sont aussi enregistrés automatiquement sur votre compte.",
		saving: "Enregistrement…",
		saved: "Profil enregistré.",
	},
	security: {
		passwordTitle: "Mot de passe",
		noPassword: (email: string) =>
			`Ce compte n'a pas encore de mot de passe : il se connecte avec Discord. Pour en définir un, déconnectez-vous puis utilisez « Mot de passe oublié » avec ${email}.`,
		discordOnly:
			"Ce compte se connecte uniquement avec Discord : il n'a ni adresse e-mail ni mot de passe.",
		changeTitle: "Changer de mot de passe",
		current: "Mot de passe actuel",
		change: "Modifier le mot de passe",
		changed: "Mot de passe modifié. Vos autres appareils ont été déconnectés.",
		deleteTitle: "Supprimer le compte",
		deleteHint:
			"Supprime définitivement le compte, son historique et ses statistiques.",
		deleteWithPassword: "Confirmez avec votre mot de passe",
		deleteWithWord: (word: string) => `Tapez ${word} pour confirmer`,
		deleting: "Suppression…",
		deleteForever: "Supprimer définitivement",
		deleteMine: "Supprimer mon compte",
		deleted: "Compte supprimé.",
		discordBoth:
			"Vous pouvez vous connecter avec Discord ou avec votre adresse e-mail.",
		discordSole:
			"Discord est votre seul moyen de connexion : il ne peut pas être délié pour l'instant.",
		unlink: "Délier",
		unlinked: "Compte Discord délié.",
		linkHint:
			"Liez votre compte Discord pour pouvoir vous connecter en un clic.",
		link: "Lier mon compte Discord",
	},
	summary: {
		discord: (username: string | null) =>
			`Discord : ${username ?? "compte lié"}`,
		memberSince: (date: Date) =>
			`membre depuis le ${new Intl.DateTimeFormat("fr-FR", LONG_DATE).format(date)}`,
		signOut: "Se déconnecter",
		signedOut: "Vous êtes déconnecté.",
		games: "Parties",
		wins: "Victoires",
		best: "Meilleur score",
		total: "Points cumulés",
		rewardUnlocked: "Débloquée",
	},
	panels: {
		history: "Historique",
		rewards: "Récompenses",
		profile: "Profil",
		security: "Sécurité",
	},
	notices: {
		connecte: "Connexion avec Discord réussie.",
		cree: "Compte créé avec Discord, bienvenue !",
		lie: "Votre compte Discord est maintenant lié.",
		annule: "Connexion Discord annulée.",
		indisponible:
			"La connexion avec Discord n'est pas configurée sur ce serveur.",
		"erreur-etat":
			"La demande Discord a expiré ou n'est pas valide : recommencez depuis le jeu.",
		"erreur-session":
			"Votre session a expiré : reconnectez-vous avant de lier Discord.",
		"erreur-discord":
			"Discord n'a pas pu confirmer votre identité. Réessayez dans un instant.",
		"deja-lie": "Ce compte Discord est déjà lié à un autre compte MOLDIUS.",
		"email-existant":
			"Un compte MOLDIUS utilise déjà l'adresse e-mail de ce compte Discord : connectez-vous avec votre mot de passe, puis liez Discord depuis « Mon compte ».",
		emailConfirmed: "Adresse confirmée : votre compte est prêt, bienvenue !",
	} satisfies Record<AccountNoticeKey, string>,
};

export const accountEn: typeof accountFr = {
	titleGuest: "Player account",
	titleSignedIn: "My account",
	titleReset: "Forgot password",
	loading: "Loading…",
	disabled: "Player accounts are not enabled on this server.",
	unavailable: "The account service is temporarily unavailable.",
	retry: "Retry",
	network: "Server unreachable, check your connection.",
	unexpected: "Unexpected server response.",
	tabs: { login: "Sign in", register: "Create an account" },
	discordRegister: "Create an account with Discord",
	discordLogin: "Sign in with Discord",
	orEmail: "or with an email address",
	forgotHint:
		"Enter your account's address: you will receive a link to choose a new password.",
	email: "Email address",
	password: "Password",
	confirmPassword: "Confirm password",
	registerHint: (name: string) =>
		`Password of at least 10 characters. A confirmation email will be sent to you; your name “${name}”, your hat and your language will be saved to the account.`,
	nameFirst: "First choose a name of 2 characters or more on the home screen.",
	passwordRequired: "Enter your password.",
	createAccount: "Create account",
	receiveLink: "Send me a link",
	signIn: "Sign in",
	forgot: "Forgot password?",
	backToLogin: "Back to sign in",
	signedInToast: "Signed in.",
	checkMailbox: "Check your inbox",
	requestSent: "Request sent",
	registerSent: (email: string) =>
		`If ${email} can receive an account, a confirmation email has just been sent to it. Open the link it contains (valid for 24 hours) to activate your account.`,
	resetSent: (email: string) =>
		`If an account matches ${email}, a link to choose a new password has just been sent (valid for 1 hour).`,
	spamHint: "Remember to check your spam folder.",
	guestNote: (limit: number) =>
		`An account keeps your name, your hat, your language, your statistics and the history of your last ${limit} games. Playing without one is fine.`,
	newPasswordTitle: "New password",
	newPassword: "New password",
	confirmNewPassword: "Confirm new password",
	otherDevices: "Your other devices will be signed out.",
	resetDone: "Password changed: you are signed in.",
	history: {
		loading: "Loading history…",
		empty:
			"No game recorded yet. Finish a hunt while signed in to find it here.",
		date: "Date",
		match: "Game",
		name: "Name",
		rank: "Rank",
		points: "Points",
		captures: "Captures",
		deaths: "Deaths",
		private: "Private",
		public: "Public",
		rankLabel: (rank: number) => {
			const tens = rank % 100;
			const suffix =
				tens >= 11 && tens <= 13
					? "th"
					: (["th", "st", "nd", "rd"][rank % 10] ?? "th");
			return `${rank}${suffix}`;
		},
		limit: (limit: number) => `Only the last ${limit} games are kept.`,
		dateTime: (date: Date) =>
			new Intl.DateTimeFormat("en-GB", DATE_TIME).format(date),
	},
	profile: {
		displayName: "In-game name",
		hint: "The name, hat and lantern chosen on the home screen, and the language chosen in the settings, are also saved to your account automatically.",
		saving: "Saving…",
		saved: "Profile saved.",
	},
	security: {
		passwordTitle: "Password",
		noPassword: (email: string) =>
			`This account has no password yet: it signs in with Discord. To set one, sign out and use “Forgot password” with ${email}.`,
		discordOnly:
			"This account only signs in with Discord: it has neither email nor password.",
		changeTitle: "Change password",
		current: "Current password",
		change: "Change password",
		changed: "Password changed. Your other devices have been signed out.",
		deleteTitle: "Delete account",
		deleteHint:
			"Permanently deletes the account, its history and its statistics.",
		deleteWithPassword: "Confirm with your password",
		deleteWithWord: (word: string) => `Type ${word} to confirm`,
		deleting: "Deleting…",
		deleteForever: "Delete permanently",
		deleteMine: "Delete my account",
		deleted: "Account deleted.",
		discordBoth: "You can sign in with Discord or with your email address.",
		discordSole:
			"Discord is your only way to sign in: it cannot be unlinked for now.",
		unlink: "Unlink",
		unlinked: "Discord account unlinked.",
		linkHint: "Link your Discord account to sign in with one click.",
		link: "Link my Discord account",
	},
	summary: {
		discord: (username: string | null) =>
			`Discord: ${username ?? "linked account"}`,
		memberSince: (date: Date) =>
			`member since ${new Intl.DateTimeFormat("en-GB", LONG_DATE).format(date)}`,
		signOut: "Sign out",
		signedOut: "You are signed out.",
		games: "Games",
		wins: "Wins",
		best: "Best score",
		total: "Total points",
		rewardUnlocked: "Unlocked",
	},
	panels: {
		history: "History",
		rewards: "Rewards",
		profile: "Profile",
		security: "Security",
	},
	notices: {
		connecte: "Signed in with Discord.",
		cree: "Account created with Discord, welcome!",
		lie: "Your Discord account is now linked.",
		annule: "Discord sign-in cancelled.",
		indisponible: "Signing in with Discord is not configured on this server.",
		"erreur-etat":
			"The Discord request expired or is invalid: start again from the game.",
		"erreur-session":
			"Your session expired: sign in again before linking Discord.",
		"erreur-discord":
			"Discord could not confirm your identity. Please try again in a moment.",
		"deja-lie":
			"This Discord account is already linked to another MOLDIUS account.",
		"email-existant":
			"A MOLDIUS account already uses this Discord account's email address: sign in with your password, then link Discord from “My account”.",
		emailConfirmed: "Address confirmed: your account is ready, welcome!",
	},
};
