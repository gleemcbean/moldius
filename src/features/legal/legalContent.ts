export type LegalLanguage = "fr" | "en";
export type LegalDocument = "terms" | "privacy";
export interface LegalSection {
	heading: string;
	paragraphs: string[];
}
export interface LegalCopy {
	title: string;
	eyebrow: string;
	intro: string;
	sections: LegalSection[];
}

export const legalContent: Record<
	LegalDocument,
	Record<LegalLanguage, LegalCopy>
> = {
	terms: {
		fr: {
			title: "Conditions d'utilisation",
			eyebrow: "TERMES DU SERVICE",
			intro:
				"Ces conditions encadrent votre accès à MOLDIUS, un jeu multijoueur en ligne. En utilisant le service, vous acceptez les présentes conditions, sous réserve de vos droits impératifs.",
			sections: [
				{
					heading: "1. Éditeur et contact",
					paragraphs: [
						"MOLDIUS est exploité par Gaston Chenet, établi à Paris 75014, joignable à contact@mycelium.gacht.xyz. Ces informations doivent être complétées avant la mise en ligne.",
					],
				},
				{
					heading: "2. Accès au jeu",
					paragraphs: [
						"Le jeu nécessite une connexion Internet, un navigateur compatible et l'accès à un microphone pour rejoindre une partie. Certaines fonctions peuvent dépendre des autorisations de votre appareil ou du navigateur.",
						"Vous pouvez jouer sous un pseudonyme sans créer de compte. Un compte facultatif permet notamment de retrouver votre profil, votre historique et vos statistiques.",
					],
				},
				{
					heading: "3. Comptes et sécurité",
					paragraphs: [
						"Vous vous engagez à fournir des informations exactes lorsque cela est nécessaire, à préserver la confidentialité de vos identifiants et à signaler toute utilisation non autorisée de votre compte.",
						"La connexion par Discord, lorsqu'elle est proposée, relève également des conditions de ce prestataire. Vous pouvez demander la suppression de votre compte depuis les paramètres de votre compte.",
					],
				},
				{
					heading: "4. Comportement entre joueurs",
					paragraphs: [
						"Sont interdits : le harcèlement, les menaces, les propos haineux, l'usurpation d'identité, la triche, l'exploitation abusive de failles, les tentatives de perturbation du service et toute utilisation illégale.",
						"Le chat vocal permet des échanges directs entre joueurs. Vous êtes responsable des propos et contenus que vous y communiquez. N'y divulguez pas d'informations sensibles vous concernant ou concernant d'autres personnes.",
					],
				},
				{
					heading: "5. Enregistrement du micro et Doppelgänger",
					paragraphs: [
						"En acceptant ces conditions, vous acceptez que votre micro soit enregistré pendant les parties. Le jeu de chaque autre participant enregistre de courts extraits de ce que vous dites dans le chat vocal (3 secondes au maximum, 6 extraits au plus par joueur). Le Doppelgänger, un monstre du jeu qui imite les joueurs, les rejoue ensuite aux autres joueurs pour se faire passer pour vous, à proximité ou au talkie-walkie. Le jeu de chaque participant garde aussi en mémoire votre voix autour des moments marquants de la partie, pour la faire entendre à tous dans les meilleurs moments rejoués à la fin.",
						"À la fin de chaque partie, une fois les meilleurs moments terminés, le jeu supprime tous les extraits. Pendant la partie, ils restent en mémoire sur les appareils des participants : ils ne sont ni envoyés au serveur du jeu ni sauvegardés.",
						"Cet enregistrement fait partie du jeu : il est toujours actif et ne peut pas être désactivé. Dans votre premier lobby, un message vous demande si vous acceptez ces conditions. Si vous ne les acceptez pas, vous ne pouvez pas rejoindre de partie.",
					],
				},
				{
					heading: "6. Disponibilité et évolution",
					paragraphs: [
						"Nous pouvons corriger, faire évoluer, interrompre temporairement ou mettre fin à certaines fonctionnalités pour des motifs techniques, de sécurité ou d'exploitation, dans le respect du droit applicable. Une disponibilité ininterrompue n'est pas garantie.",
					],
				},
				{
					heading: "7. Propriété intellectuelle",
					paragraphs: [
						"Les éléments originaux du jeu (notamment code, graphismes, univers, textes et sons) sont protégés dans les conditions prévues par la loi. Aucun droit de reproduction, de distribution ou d'exploitation commerciale ne vous est accordé en dehors des autorisations expresses ou licences applicables.",
					],
				},
				{
					heading: "8. Responsabilité",
					paragraphs: [
						"Vous utilisez le service dans le respect de la loi et des présentes conditions. Rien dans ce document n'exclut les garanties ou responsabilités qui ne peuvent légalement être limitées, ni vos droits en tant que consommateur lorsque ceux-ci sont applicables.",
					],
				},
				{
					heading: "9. Données personnelles",
					paragraphs: [
						"Le traitement de vos données est présenté dans notre Politique de confidentialité, accessible depuis cette page.",
					],
				},
				{
					heading: "10. Modification des conditions",
					paragraphs: [
						"Nous pouvons modifier ces conditions pour refléter une évolution du service ou de la réglementation. Les changements importants seront portés à votre connaissance par un moyen approprié. La version en vigueur indique sa date de mise à jour.",
					],
				},
				{
					heading: "11. Droit applicable",
					paragraphs: [
						"Les présentes conditions sont régies par le droit applicable à l'éditeur, sans préjudice des dispositions impératives protégeant les consommateurs de leur pays de résidence. En cas de différend, privilégiez d'abord une prise de contact à l'adresse indiquée ci-dessus.",
					],
				},
			],
		},
		en: {
			title: "Terms of Service",
			eyebrow: "TERMS OF SERVICE",
			intro:
				"These terms govern your access to MOLDIUS, an online multiplayer game. By using the service, you agree to these terms, subject to your mandatory legal rights.",
			sections: [
				{
					heading: "1. Operator and contact",
					paragraphs: [
						"MOLDIUS is operated by Gaston Chenet, located at Paris 75014, and can be contacted at contact@mycelium.gacht.xyz. Complete these details before publication.",
					],
				},
				{
					heading: "2. Access to the game",
					paragraphs: [
						"The game requires an Internet connection, a compatible browser and microphone access to join a match. Some features depend on your device or browser permissions.",
						"You can play with a nickname without registering. An optional account lets you keep your profile, match history and statistics.",
					],
				},
				{
					heading: "3. Accounts and security",
					paragraphs: [
						"You agree to provide accurate information where necessary, keep your credentials confidential and report unauthorized account access.",
						"Sign-in through Discord, when enabled, is also subject to that provider's terms. You can request account deletion using your account settings.",
					],
				},
				{
					heading: "4. Player conduct",
					paragraphs: [
						"Harassment, threats, hateful speech, impersonation, cheating, exploiting vulnerabilities, disrupting the service and unlawful use are prohibited.",
						"Voice chat enables direct interaction between players. You are responsible for what you say or share and should not reveal sensitive information about yourself or others.",
					],
				},
				{
					heading: "5. Microphone recording and the Doppelgänger",
					paragraphs: [
						"By accepting these terms, you agree that your microphone is recorded during matches. Every other participant's game records short clips of what you say in voice chat (up to 3 seconds each, at most 6 clips per player). The Doppelgänger, an in-game monster that imitates players, then plays them to other players to pass as you, nearby or over the walkie-talkie. Each participant's game also keeps your voice in memory around the match's notable moments, so everyone can hear it in the best moments replayed at the end.",
						"At the end of every match, once the best moments are over, the game deletes all clips. During the match, they stay in memory on participants' devices: they are neither sent to the game server nor saved.",
						"This recording is part of the game: it is always active and cannot be turned off. In your first lobby, a message asks whether you accept these terms. If you do not accept them, you cannot join a match.",
					],
				},
				{
					heading: "6. Availability and changes",
					paragraphs: [
						"We may update, correct, temporarily interrupt or discontinue features for technical, security or operational reasons, subject to applicable law. Uninterrupted availability is not guaranteed.",
					],
				},
				{
					heading: "7. Intellectual property",
					paragraphs: [
						"Original game elements, including code, artwork, world-building, text and audio, are protected by applicable law. No permission to reproduce, distribute or commercially exploit them is granted except where explicitly authorized or under an applicable license.",
					],
				},
				{
					heading: "8. Liability",
					paragraphs: [
						"You must use the service lawfully and comply with these terms. Nothing here excludes warranties, liabilities or consumer rights that cannot legally be excluded or restricted.",
					],
				},
				{
					heading: "9. Personal data",
					paragraphs: [
						"Our Privacy Policy, available from this page, explains how personal data is handled.",
					],
				},
				{
					heading: "10. Changes to these terms",
					paragraphs: [
						"We may revise these terms to reflect changes in the service or applicable regulations. We will give appropriate notice of material changes. The current version states its update date.",
					],
				},
				{
					heading: "11. Governing law",
					paragraphs: [
						"These terms are governed by the law applicable to the operator, without prejudice to mandatory consumer protections in your country of residence. Please first contact us using the details above if you have a dispute.",
					],
				},
			],
		},
	},
	privacy: {
		fr: {
			title: "Politique de confidentialité",
			eyebrow: "VIE PRIVÉE & DONNÉES",
			intro:
				"Cette politique explique quelles données peuvent être utilisées lorsque vous jouez à MOLDIUS, créez un compte ou utilisez la communication vocale.",
			sections: [
				{
					heading: "1. Responsable du traitement",
					paragraphs: [
						"Responsable : Gaston Chenet, Paris 75014. Contact pour les questions et demandes relatives aux données : privacy@mycelium.gacht.xyz. Ces mentions sont à compléter avant publication.",
					],
				},
				{
					heading: "2. Données traitées",
					paragraphs: [
						"Jeu et session : pseudonyme, apparence du personnage, code ou identifiant de salon, présence et événements de partie nécessaires à la synchronisation multijoueur.",
						"Compte facultatif : adresse e-mail, pseudonyme, préférences, langue, empreinte sécurisée du mot de passe (jamais le mot de passe en clair), jetons de session protégés sous forme d'empreintes, dates de création et de connexion, résultats et historique des parties, compteurs de progression et récompenses débloquées, date d'acceptation des conditions d'utilisation.",
						"Défi du jour (avec un compte) : votre pseudonyme, votre apparence et votre meilleur score du jour apparaissent dans un classement visible par tous les joueurs. Ces lignes disparaissent avec votre compte.",
						"Connexion Discord facultative : identifiant Discord, nom d'utilisateur, avatar et, si elle est vérifiée et disponible, adresse e-mail. Les jetons d'accès Discord sont révoqués après utilisation et ne sont pas conservés par le jeu.",
						"Amis et présence (avec un compte) : code ami, liste d'amis et demandes, statut affiché à vos amis (en ligne, dans un lobby, en partie), option « apparaître hors ligne » et date de dernière visite. Le nombre de personnes connectées est aussi relevé régulièrement, sous forme de totaux anonymes, pour connaître les heures d'affluence.",
						"Données techniques : informations de connexion nécessaires à la sécurité, au routage des échanges et au fonctionnement du service ; l'adresse IP peut être traitée par l'infrastructure réseau ou d'hébergement.",
					],
				},
				{
					heading: "3. Microphone, voix et reconnaissance vocale",
					paragraphs: [
						"Le microphone est nécessaire pour participer aux parties. Le chat vocal utilise des connexions WebRTC entre joueurs, avec une signalisation assurée par le serveur ; selon la configuration réseau, des serveurs STUN/TURN peuvent faciliter la connexion.",
						"Le code examiné n'implémente pas d'enregistrement systématique des conversations vocales sur le serveur du jeu. Les incantations peuvent exploiter la reconnaissance vocale intégrée au navigateur : selon celui-ci, des données audio peuvent être transmises à son fournisseur pour transcription. Vérifiez les paramètres et la politique de confidentialité de votre navigateur.",
						"Enregistrement du micro et Doppelgänger : pendant une partie, le jeu de chaque participant enregistre de courts extraits de la voix des autres joueurs (3 secondes au maximum, 6 extraits au plus par joueur) pour que ce monstre puisse les imiter auprès des autres joueurs. Ces extraits restent en mémoire sur les appareils des participants et ne sont ni envoyés au serveur du jeu ni sauvegardés. À la fin de chaque partie, une fois les meilleurs moments terminés, le jeu les supprime tous. Cet enregistrement est toujours actif et ne peut pas être désactivé ; il fait partie des Conditions d'utilisation, que vous devez accepter pour jouer. Si vous êtes connecté, votre acceptation et sa date sont enregistrées sur votre compte ; sinon, elle reste dans votre navigateur.",
						"Talkie-walkie : si vous en tenez un en partie, votre voix est aussi transmise, par les mêmes connexions entre joueurs, à ceux qui en ont un, quelle que soit leur distance.",
						"Meilleurs moments : le jeu de chaque participant garde en mémoire les dernières secondes de la voix de tous les joueurs, puis les passages autour des moments marquants (une dizaine de secondes par moment, une dizaine de moments au plus). En fin de partie, le serveur envoie les positions et le niveau sonore du micro, et chaque appareil y ajoute la voix qu'il a gardée pour rejouer les trois meilleurs. La voix n'est ni envoyée au serveur du jeu ni sauvegardée, et le jeu la supprime une fois les meilleurs moments terminés.",
					],
				},
				{
					heading: "4. Finalités et bases légales",
					paragraphs: [
						"Exécution du service demandé : création et participation aux parties, gestion des comptes, authentification, profil et statistiques (exécution du contrat ou mesures précontractuelles).",
						"Imitation vocale par le Doppelgänger : fonctionnement du jeu (exécution du contrat).",
						"Sécurité et prévention des abus : protection des sessions, limitation des tentatives et diagnostic technique (intérêt légitime, sous réserve de la mise en balance applicable).",
						"Fonctions facultatives, telles que Discord ou l'accès au microphone, selon l'action et l'autorisation que vous choisissez ; l'autorisation technique du navigateur ne remplace pas à elle seule toute base légale éventuellement requise.",
					],
				},
				{
					heading: "5. Destinataires et services tiers",
					paragraphs: [
						"Les données nécessaires peuvent être accessibles à l'éditeur et aux prestataires techniques intervenant dans l'hébergement, la base de données et l'envoi d'e-mails. Discord intervient si vous activez sa connexion ; le navigateur et les services de connexion vocale peuvent également traiter des données.",
						"La liste des prestataires, leurs lieux de traitement et, s'il y a lieu, les garanties encadrant les transferts hors Espace économique européen doivent être vérifiés et renseignés par l'éditeur avant publication.",
					],
				},
				{
					heading: "6. Conservation",
					paragraphs: [
						"Les données du compte et l'historique associé sont conservés tant que votre compte est actif, sous réserve des obligations légales et des sauvegardes applicables. La suppression du compte entraîne la suppression des enregistrements associés dans la base active.",
						"Les sessions expirent et les jetons de vérification et de réinitialisation ont une durée de validité limitée. Les données temporaires de partie ne sont en principe utiles que pendant la session concernée. Les extraits de voix (Doppelgänger et meilleurs moments) sont supprimés à la fin de chaque partie, une fois les meilleurs moments terminés.",
						"À compléter : durées précises des journaux techniques, des sauvegardes et de leur purge, après vérification de l'hébergement réel.",
					],
				},
				{
					heading: "7. Cookies et stockage local",
					paragraphs: [
						"Un cookie de session d'authentification HttpOnly et SameSite=Strict peut être utilisé pour maintenir votre connexion ; un cookie OAuth temporaire SameSite=Lax sert à sécuriser l'authentification Discord. Le navigateur conserve également des préférences de jeu dans son stockage local.",
						"Ces mécanismes sont destinés au fonctionnement du service. Aucun outil publicitaire ou de suivi analytique tiers n'a été identifié dans le code fourni ; cette information doit être réévaluée si de tels services sont ajoutés.",
					],
				},
				{
					heading: "8. Sécurité",
					paragraphs: [
						"Des mesures de protection sont mises en œuvre, notamment le hachage des mots de passe et jetons et des attributs de sécurité des cookies. Aucun service en ligne ne peut toutefois garantir une sécurité absolue.",
					],
				},
				{
					heading: "9. Vos droits",
					paragraphs: [
						"Selon le RGPD et les lois applicables, vous pouvez disposer de droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité, ainsi que du droit de retirer votre consentement lorsque le traitement repose sur celui-ci.",
						"Pour exercer vos droits, contactez privacy@mycelium.gacht.xyz. Vous pouvez également supprimer votre compte dans l'application. En France, vous pouvez adresser une réclamation à la CNIL (cnil.fr).",
					],
				},
				{
					heading: "10. Mineurs et évolutions",
					paragraphs: [
						"Les règles d'âge et d'autorisation parentale applicables doivent être définies par l'éditeur avant l'ouverture du service au public. Cette politique peut être actualisée ; toute évolution substantielle sera signalée par un moyen approprié.",
					],
				},
			],
		},
		en: {
			title: "Privacy Policy",
			eyebrow: "PRIVACY & DATA",
			intro:
				"This policy explains what data may be used when you play MOLDIUS, create an account or use voice communication.",
			sections: [
				{
					heading: "1. Data controller",
					paragraphs: [
						"Controller: Gaston Chenet, Paris 75014. Privacy enquiries and data requests: privacy@mycelium.gacht.xyz. Complete these details before publication.",
					],
				},
				{
					heading: "2. Data we process",
					paragraphs: [
						"Game and session: nickname, character appearance, lobby code or identifier, presence and match events needed for multiplayer synchronization.",
						"Optional account: email address, nickname, preferences, language, securely hashed password (never a plain-text password), hashed session tokens, creation and login dates, scores and match history, progress counters and unlocked rewards, date you accepted the Terms of Service.",
						"Daily challenge (with an account): your nickname, appearance and best score of the day appear on a leaderboard visible to all players. These rows are deleted with your account.",
						"Optional Discord login: Discord ID, username, avatar and, where available and verified, email address. Discord access tokens are revoked after use and are not retained by the game.",
						'Friends and presence (with an account): friend code, friend list and requests, status shown to your friends (online, in a lobby, in a match), the "appear offline" option and last visit date. The number of connected people is also sampled regularly, as anonymous totals, to understand busy hours.',
						"Technical information: connection details needed to secure and operate the service; your IP address may be processed by network and hosting infrastructure.",
					],
				},
				{
					heading: "3. Microphone, voice and speech recognition",
					paragraphs: [
						"A microphone is required to participate in matches. Voice chat uses peer-to-peer WebRTC connections, with server-assisted signaling; depending on network configuration, STUN/TURN services may help establish a connection.",
						"The reviewed code does not implement routine server-side recording of voice conversations. Incantations may use the browser's built-in speech recognition; depending on the browser, audio may be sent to its provider for transcription. Consult your browser's settings and privacy notice.",
						"Microphone recording and the Doppelgänger: during a match, each participant's game records short clips of the other players' voices (up to 3 seconds each, at most 6 clips per player) so this monster can imitate them to other players. Clips stay in memory on participants' devices and are neither sent to the game server nor saved. At the end of every match, once the best moments are over, the game deletes them all. This recording is always active and cannot be turned off; it is part of the Terms of Service, which you must accept to play. If you are signed in, your acceptance and its date are saved to your account; otherwise, it stays in your browser.",
						"Walkie-talkie: if you hold one during a match, your voice is also sent, over the same player-to-player connections, to others holding one, whatever the distance.",
						"Best moments: each participant's game keeps the last seconds of all players' voices in memory, then the passages around notable moments (about ten seconds per moment, about ten moments at most). At the end of a match, the server sends positions and microphone level, and each device adds the voice it kept to replay the best three. Voice is neither sent to the game server nor saved, and the game deletes it once the best moments are over.",
					],
				},
				{
					heading: "4. Purposes and legal bases",
					paragraphs: [
						"Providing the requested service: joining and running matches, accounts, authentication, profiles and statistics (performance of a contract or pre-contractual steps).",
						"Voice imitation by the Doppelgänger: operating the game (performance of a contract).",
						"Security and abuse prevention: protecting sessions, limiting repeated attempts and technical diagnostics (legitimate interests, subject to an applicable balancing test).",
						"Optional features, such as Discord sign-in or microphone access, are used based on your choices and permissions; browser permission alone does not necessarily establish every legally required processing basis.",
					],
				},
				{
					heading: "5. Recipients and third parties",
					paragraphs: [
						"Data may be available to the operator and technical providers for hosting, databases and transactional emails. Discord is involved when you enable its login; your browser and voice connectivity services may also process information.",
						"Before publication, the operator must confirm and disclose relevant service providers, processing locations and any safeguards applicable to transfers outside the European Economic Area.",
					],
				},
				{
					heading: "6. Retention",
					paragraphs: [
						"Account information and associated match history are retained while your account remains active, subject to legal obligations and relevant backups. Account deletion deletes the associated records from the active database.",
						"Sessions expire, and verification and password-reset tokens have limited validity periods. Temporary match data is generally required only for the relevant session. Voice clips (Doppelgänger and best moments) are deleted at the end of every match, once the best moments are over.",
						"To complete: exact retention and deletion schedules for technical logs and backups, based on the actual hosting environment.",
					],
				},
				{
					heading: "7. Cookies and local storage",
					paragraphs: [
						"An HttpOnly, SameSite=Strict authentication cookie may maintain your session; a temporary SameSite=Lax OAuth cookie protects Discord authentication. The browser also stores game preferences locally.",
						"These technologies support core functions. No third-party advertising or analytics tracker was identified in the supplied code; this should be reviewed whenever additional services are introduced.",
					],
				},
				{
					heading: "8. Security",
					paragraphs: [
						"Protective measures include hashing passwords and tokens and applying security attributes to cookies. No online service can guarantee absolute security.",
					],
				},
				{
					heading: "9. Your rights",
					paragraphs: [
						"Under the GDPR and applicable laws, you may have rights to access, correct, erase, restrict, object to and transfer your personal data, as well as to withdraw consent when processing is based on consent.",
						"To exercise these rights, contact privacy@mycelium.gacht.xyz. You may also delete your account in the application. In France, you may lodge a complaint with the CNIL (cnil.fr).",
					],
				},
				{
					heading: "10. Children and updates",
					paragraphs: [
						"Applicable age and parental authorization requirements must be determined by the operator before publicly launching the service. This policy may change, and material changes will be communicated appropriately.",
					],
				},
			],
		},
	},
};
