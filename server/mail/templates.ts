import type { Language } from "../../shared/i18n/languages.js";
import type { MailMessage } from "./mailer.js";

const CHROME: Record<
	Language,
	{ automatic: string; fallback: string; colon: string }
> = {
	fr: {
		automatic:
			"Cet e-mail est envoyé automatiquement, merci de ne pas y répondre.",
		fallback:
			"Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
		colon: " : ",
	},
	en: {
		automatic: "This email was sent automatically, please do not reply.",
		fallback: "If the button does not work, copy this link into your browser:",
		colon: ": ",
	},
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

interface Layout {
	to: string;
	subject: string;
	title: string;
	paragraphs: string[];
	action?: { label: string; url: string };
	footnote: string;
}

function compose(layout: Layout, language: Language): MailMessage {
	const chrome = CHROME[language];
	const text = [
		layout.title,
		"",
		...layout.paragraphs.flatMap((paragraph) => [paragraph, ""]),
		...(layout.action
			? [`${layout.action.label}${chrome.colon}${layout.action.url}`, ""]
			: []),
		layout.footnote,
		"",
		`, MOLDIUS`,
		chrome.automatic,
	].join("\n");
	const paragraphs = layout.paragraphs
		.map(
			(paragraph) =>
				`<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#ecefe2;">${escapeHtml(paragraph)}</p>`,
		)
		.join("");
	const action = layout.action
		? `<p style="margin:24px 0;"><a href="${escapeHtml(layout.action.url)}" style="display:inline-block;padding:14px 24px;background:#dce54d;color:#111512;font-weight:bold;font-size:16px;text-decoration:none;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(layout.action.label)}</a></p><p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#9fa894;">${escapeHtml(chrome.fallback)}<br><span style="color:#dce54d;word-break:break-all;">${escapeHtml(layout.action.url)}</span></p>`
		: "";
	const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(layout.subject)}</title></head><body style="margin:0;padding:0;background:#0b0d0b;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d0b;padding:24px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#191e1a;border:2px solid #dce54d;"><tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0 0 4px;font-size:28px;font-weight:900;letter-spacing:0.06em;color:#dce54d;">MOLDIUS</p><h1 style="margin:0 0 18px;font-size:22px;color:#ecefe2;">${escapeHtml(layout.title)}</h1>${paragraphs}${action}<p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#9fa894;">${escapeHtml(layout.footnote)}</p></td></tr><tr><td style="padding:16px 28px;border-top:1px solid #2f3a31;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6c7566;">${escapeHtml(chrome.automatic)}</td></tr></table></td></tr></table></body></html>`;
	return { to: layout.to, subject: layout.subject, text, html };
}

type Content = Omit<Layout, "to">;

export function verificationEmail(
	to: string,
	displayName: string,
	url: string,
	language: Language = "fr",
): MailMessage {
	const content: Record<Language, Content> = {
		fr: {
			subject: "Confirmez votre adresse e-mail",
			title: `Bienvenue, ${displayName} !`,
			paragraphs: [
				"Pour terminer la création de votre compte MOLDIUS, confirmez votre adresse e-mail. Le lien est valable 24 heures et ne sert qu'une fois.",
			],
			action: { label: "Confirmer mon adresse", url },
			footnote:
				"Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message : aucun compte ne sera créé.",
		},
		en: {
			subject: "Confirm your email address",
			title: `Welcome, ${displayName}!`,
			paragraphs: [
				"To finish creating your MOLDIUS account, please confirm your email address. The link is valid for 24 hours and can only be used once.",
			],
			action: { label: "Confirm my address", url },
			footnote:
				"If you did not sign up, just ignore this message: no account will be created.",
		},
	};
	return compose({ to, ...content[language] }, language);
}

export function alreadyRegisteredEmail(
	to: string,
	url: string,
	language: Language = "fr",
): MailMessage {
	const content: Record<Language, Content> = {
		fr: {
			subject: "Votre compte MOLDIUS existe déjà",
			title: "Un compte utilise déjà cette adresse",
			paragraphs: [
				"Quelqu'un, peut-être vous, a voulu créer un compte MOLDIUS avec cette adresse, mais un compte existe déjà. Rien n'a été modifié.",
				"Vous pouvez vous connecter normalement. En cas d'oubli, utilisez « Mot de passe oublié » dans la fenêtre de connexion.",
			],
			action: { label: "Ouvrir MOLDIUS", url },
			footnote:
				"Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.",
		},
		en: {
			subject: "Your MOLDIUS account already exists",
			title: "An account already uses this address",
			paragraphs: [
				"Someone, perhaps you, tried to create a MOLDIUS account with this address, but an account already exists. Nothing has been changed.",
				"You can sign in as usual. If you forgot your password, use “Forgot password” in the sign-in window.",
			],
			action: { label: "Open MOLDIUS", url },
			footnote:
				"If you did not make this request, you can ignore this message.",
		},
	};
	return compose({ to, ...content[language] }, language);
}

export function passwordResetEmail(
	to: string,
	url: string,
	language: Language = "fr",
): MailMessage {
	const content: Record<Language, Content> = {
		fr: {
			subject: "Réinitialisation de votre mot de passe",
			title: "Choisissez un nouveau mot de passe",
			paragraphs: [
				"Une réinitialisation du mot de passe de votre compte MOLDIUS a été demandée. Le lien est valable 1 heure et ne sert qu'une fois.",
			],
			action: { label: "Choisir un nouveau mot de passe", url },
			footnote:
				"Si vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste inchangé.",
		},
		en: {
			subject: "Reset your password",
			title: "Choose a new password",
			paragraphs: [
				"A password reset was requested for your MOLDIUS account. The link is valid for 1 hour and can only be used once.",
			],
			action: { label: "Choose a new password", url },
			footnote:
				"If you did not request anything, ignore this message: your current password stays unchanged.",
		},
	};
	return compose({ to, ...content[language] }, language);
}

export function passwordChangedEmail(
	to: string,
	url: string,
	language: Language = "fr",
): MailMessage {
	const content: Record<Language, Content> = {
		fr: {
			subject: "Votre mot de passe MOLDIUS a été modifié",
			title: "Mot de passe modifié",
			paragraphs: [
				"Le mot de passe de votre compte MOLDIUS vient d'être modifié. Les autres appareils connectés ont été déconnectés.",
			],
			action: { label: "Ouvrir MOLDIUS", url },
			footnote:
				"Si vous n'êtes pas à l'origine de ce changement, utilisez immédiatement « Mot de passe oublié » pour reprendre la main sur votre compte.",
		},
		en: {
			subject: "Your MOLDIUS password was changed",
			title: "Password changed",
			paragraphs: [
				"The password of your MOLDIUS account has just been changed. Other signed-in devices have been signed out.",
			],
			action: { label: "Open MOLDIUS", url },
			footnote:
				"If you did not make this change, use “Forgot password” immediately to regain control of your account.",
		},
	};
	return compose({ to, ...content[language] }, language);
}
