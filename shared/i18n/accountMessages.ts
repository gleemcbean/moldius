import type { Language } from "./languages.js";

const FR = {
	invalidCredentials: "Adresse e-mail ou mot de passe incorrect.",
	mailUnavailable: "L'envoi d'e-mails n'est pas configuré sur ce serveur.",
	mailFailed: "L'e-mail n'a pas pu être envoyé, réessayez plus tard.",
	registrationLinkInvalid:
		"Ce lien est invalide ou a expiré. Recommencez l'inscription.",
	resetLinkInvalid:
		"Ce lien est invalide ou a expiré. Demandez un nouveau lien.",
	linkInvalid: "Ce lien est invalide ou a expiré.",
	emailAlreadyConfirmed: "Cette adresse est déjà confirmée : connectez-vous.",
	emailMissing: "Indiquez votre adresse e-mail.",
	emailInvalid: "Adresse e-mail invalide.",
	passwordMissing: "Mot de passe manquant.",
	passwordTooShort: "Le mot de passe doit contenir au moins {min} caractères.",
	passwordTooLong: "Le mot de passe ne peut pas dépasser {max} caractères.",
	passwordContainsEmail:
		"Le mot de passe ne doit pas contenir votre adresse e-mail.",
	passwordTooWeak: "Ce mot de passe est trop facile à deviner.",
	passwordsDiffer: "Les deux mots de passe ne correspondent pas.",
	displayNameInvalid: "Choisissez un pseudonyme de 2 à 18 caractères.",
	colorInvalid: "Couleur de chapeau inconnue.",
	patternInvalid: "Motif de chapeau inconnu.",
	languageInvalid: "Langue inconnue.",
	sessionExpired: "Session expirée, reconnectez-vous.",
	noPasswordYet:
		"Ce compte n'a pas encore de mot de passe : utilisez « Mot de passe oublié » pour en définir un.",
	currentPasswordWrong: "Mot de passe actuel incorrect.",
	newPasswordMissing: "Nouveau mot de passe manquant.",
	newPasswordSame: "Le nouveau mot de passe doit être différent de l'actuel.",
	passwordWrong: "Mot de passe incorrect.",
	deleteConfirmation: "Tapez SUPPRIMER pour confirmer.",
	unlinkNeedsPassword:
		"Définissez d'abord un mot de passe avec « Mot de passe oublié » : sans Discord, vous ne pourriez plus vous connecter.",
	unlinkDiscordOnly:
		"Ce compte ne se connecte qu'avec Discord : il ne peut pas être délié.",
	tooManyMinutes: "Trop de tentatives. Réessayez dans {minutes} minutes.",
	tooManyMinute: "Trop de tentatives. Réessayez dans une minute.",
	originRefused: "Origine de la requête refusée.",
	unsupportedFormat: "Format de requête non pris en charge.",
	invalidRequest: "Requête invalide.",
	payloadTooLarge: "Requête trop volumineuse.",
	serviceUnavailable: "Service de comptes momentanément indisponible.",
	accountsDisabled: "Les comptes ne sont pas activés sur ce serveur.",
	notSignedIn: "Vous n'êtes pas connecté.",
	publicUrlMissing: "Adresse publique du site non configurée (PUBLIC_URL).",
	notFound: "Ressource introuvable.",
	serverBusy: "Serveur occupé, réessayez dans un instant.",
	internalError: "Erreur interne, réessayez plus tard.",
};

export type AccountMessageKey = keyof typeof FR;

const EN: Record<AccountMessageKey, string> = {
	invalidCredentials: "Incorrect email address or password.",
	mailUnavailable: "Sending emails is not configured on this server.",
	mailFailed: "The email could not be sent, please try again later.",
	registrationLinkInvalid:
		"This link is invalid or has expired. Please sign up again.",
	resetLinkInvalid:
		"This link is invalid or has expired. Please request a new one.",
	linkInvalid: "This link is invalid or has expired.",
	emailAlreadyConfirmed: "This address is already confirmed: please sign in.",
	emailMissing: "Enter your email address.",
	emailInvalid: "Invalid email address.",
	passwordMissing: "Password missing.",
	passwordTooShort: "The password must be at least {min} characters long.",
	passwordTooLong: "The password cannot exceed {max} characters.",
	passwordContainsEmail: "The password must not contain your email address.",
	passwordTooWeak: "This password is too easy to guess.",
	passwordsDiffer: "The two passwords do not match.",
	displayNameInvalid: "Choose a name between 2 and 18 characters.",
	colorInvalid: "Unknown hat colour.",
	patternInvalid: "Unknown hat pattern.",
	languageInvalid: "Unknown language.",
	sessionExpired: "Session expired, please sign in again.",
	noPasswordYet:
		"This account has no password yet: use “Forgot password” to set one.",
	currentPasswordWrong: "Current password is incorrect.",
	newPasswordMissing: "New password missing.",
	newPasswordSame: "The new password must differ from the current one.",
	passwordWrong: "Incorrect password.",
	deleteConfirmation: "Type DELETE to confirm.",
	unlinkNeedsPassword:
		"Set a password first with “Forgot password”: without Discord you could no longer sign in.",
	unlinkDiscordOnly:
		"This account only signs in with Discord: it cannot be unlinked.",
	tooManyMinutes: "Too many attempts. Try again in {minutes} minutes.",
	tooManyMinute: "Too many attempts. Try again in a minute.",
	originRefused: "Request origin refused.",
	unsupportedFormat: "Unsupported request format.",
	invalidRequest: "Invalid request.",
	payloadTooLarge: "Request too large.",
	serviceUnavailable: "The account service is temporarily unavailable.",
	accountsDisabled: "Accounts are not enabled on this server.",
	notSignedIn: "You are not signed in.",
	publicUrlMissing: "Public site address not configured (PUBLIC_URL).",
	notFound: "Resource not found.",
	serverBusy: "Server busy, please try again in a moment.",
	internalError: "Internal error, please try again later.",
};

const MESSAGES: Record<Language, Record<AccountMessageKey, string>> = {
	fr: FR,
	en: EN,
};

export type MessageParams = Record<string, string | number>;

export interface AccountProblem {
	key: AccountMessageKey;
	params?: MessageParams;
}

export function accountMessage(
	language: Language,
	key: AccountMessageKey,
	params: MessageParams = {},
): string {
	return MESSAGES[language][key].replace(/\{(\w+)\}/g, (match, name: string) =>
		params[name] === undefined ? match : String(params[name]),
	);
}
