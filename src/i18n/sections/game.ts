import type { AwardId } from "@shared/awards";
import type { HighlightKind } from "@shared/protocol/game";

export interface HighlightContext {
	name: string;
	other: string;
	species: string;
	value: number;
}

function seconds(ms: number): number {
	return Math.round(ms / 1000);
}

import type { AbortReason } from "@shared/protocol/events";
import type { CastFailureReason } from "@shared/protocol/game";
import type { MicStatus } from "../../features/voice/micManager";

export type LoadStepId =
	| "manor"
	| "collisions"
	| "textures"
	| "architecture"
	| "models"
	| "grimoire"
	| "audio"
	| "gpu";

export const gameFr = {
	interaction: {
		leave: (place: string) => `${place} : Sortir`,
		leaveShort: "Sortir",
		hide: (place: string) => `${place} : Se cacher`,
		openDoor: "Ouvrir la porte",
		closeDoor: "Fermer la porte",
		valveActive: "Eau verte en cours",
		valveResting: "Vanne en repos…",
		openValve: "Ouvrir la vanne d'eau verte",
		pickUp: (name: string) => `Ramasser : ${name}`,
		pickUpAny: "Ramasser un matériau",
		search: {
			chest: "Fouiller le coffre",
			crate: "Fouiller la caisse",
			smallBox: "Fouiller la boîte",
		},
		useAltar: "Utiliser l'autel",
		craft: (name: string) => `Fabriquer : ${name}`,
		missingMaterials: "Matériaux manquants : refermer",
		takeWalkie: "Prendre le talkie-walkie",
		takeCamera: "Prendre l'appareil photo",
		stakeResting: "Le feu s'est éteint : revenez plus tard",
		stakes: {
			sanctuary: "Sanctuaire : soigne, mais attire les anomalies",
			reliquary: "Reliquaire : 4 fragments, mais l'alarme sonne",
			pact: "Pacte : 50 PV contre un objet occulte",
		},
	},
	inventory: {
		title: "Fragments",
		handEmpty: "Main vide",
	},
	altar: {
		title: "Autel occulte",
		hint: "Molette ou chiffre : choisir un objet. Chaque capture consomme un objet.",
	},
	tutorial: {
		progress: (step: number, total: number) => `Étape ${step} sur ${total}`,
		skip: "Entrée : passer cette étape",
		checks: {
			range: (meters: number) => `À moins de ${meters} m du monstre`,
			object: "Objet occulte en main",
			voice: "Voix entendue par le micro",
			valveOpen: "Vanne ouverte",
			inJet: "Sous le jet",
		},
		steps: {
			move: (keys: string) => ({
				title: "Se déplacer",
				body: `${keys} pour marcher, la souris pour regarder. La minicarte montre où vous êtes. Avancez un peu.`,
			}),
			sprint: (sprint: string, jump: string) => ({
				title: "Courir et sauter",
				body: `Maintenez ${sprint} en marchant pour courir, ${jump} pour sauter. Courir, sauter et garder la lanterne ouverte vident la barre jaune d'énergie. À sec, plus de course ni de saut tant qu'elle n'est pas remontée, et une chute de la mezzanine fait mal. Courez un instant.`,
			}),
			crouch: (crouch: string) => ({
				title: "Rester discret",
				body: `Maintenez ${crouch} pour vous accroupir. Courir s'entend de loin, accroupi presque pas. Lanterne fermée, la jauge de bruit apparaît : votre voix au micro attire aussi les monstres.`,
			}),
			lantern: (key: string) => ({
				title: "La lanterne",
				body: `${key} ouvre ou ferme la lanterne. Elle éclaire, mais les monstres la voient de loin. Essayez.`,
			}),
			door: (key: string) => ({
				title: "Les portes",
				body: `Suivez l'étoile, visez une porte et appuyez sur ${key}.`,
			}),
			map: (key: string) => ({
				title: "La carte",
				body: `${key} ouvre le plan du manoir : pièces, étages, escaliers et autels. Ouvrez-le, puis refermez-le avec ${key}.`,
			}),
			loot: (key: string, list: string) => ({
				title: "Les matériaux",
				body: `Des morceaux d'objets traînent au sol, sur les meubles, dans les coffres et les boîtes. Suivez l'étoile et ramassez avec ${key} : ${list}.`,
			}),
			grimoire: (key: string) => ({
				title: "Le grimoire",
				body: `${key} ouvre le grimoire ; regardez vers le bas pour le lire. Chaque monstre a sa page : l'objet occulte à fabriquer, les conditions et la formule. La molette tourne les pages.`,
			}),
			altar: (key: string, name: string) => ({
				title: "L'autel",
				body: `Les pupitres au livre volant, marqués d'une étoile turquoise sur la minicarte, fabriquent les objets occultes. Rejoignez-en un, appuyez sur ${key}, choisissez « ${name} » à la molette, puis ${key} de nouveau.`,
			}),
			hold: (name: string) => ({
				title: "Tenir l'objet",
				body: `Pour capturer, l'objet doit être dans votre main. Sélectionnez « ${name} » dans la barre du bas, à la molette ou avec son chiffre.`,
			}),
			hide: (key: string) => ({
				title: "Se cacher",
				body: `Armoires, malles et autres cachettes protègent des monstres. Entrez dans celle qui est indiquée avec ${key}, puis ressortez.`,
			}),
			valve: (key: string, flow: number, rest: number) => ({
				title: "L'eau verte",
				body: `Vous êtes blessé : regardez la barre rouge. L'eau verte soigne. Suivez l'étoile jusqu'à une vanne, en prenant l'escalier si besoin, ouvrez-la avec ${key} et placez-vous sous le jet. Elle coule ${flow} s, puis se repose ${rest} s.`,
			}),
			push: (key: string) => ({
				title: "Pousser",
				body: `${key} pousse le joueur devant vous et interrompt son incantation. Cela coûte de l'énergie et se recharge : regardez en bas à droite. Essayez.`,
			}),
			shout: (key: string) => ({
				title: "Crier",
				body: `Un Murmure vient de s'éveiller. Un cri attire les monstres à l'endroit où vous êtes : appuyez sur ${key} pour le faire venir.`,
			}),
			capture: (formula: string) => ({
				title: "Capturer",
				body: `À moins de 5 m, l'objet occulte en main : prononcez à voix haute « ${formula} ». Lanterne ouverte ou fermée, peu importe, et inutile de viser.`,
			}),
			end: () => ({
				title: "Vous êtes prêt",
				body: `En partie, les monstres blessent pour de vrai, et l'on revient après quelques secondes quand on tombe. Un cri ou une voix forte interrompt aussi l'incantation d'un rival. Entrée pour revenir à l'accueil.`,
			}),
		},
	},
	cast: {
		noSpeech:
			"Reconnaissance vocale indisponible dans ce navigateur : incantez avec Chrome, Edge ou Safari.",
		captured: (label: string) => `Capture réussie : ${label} !`,
		failed: [
			"Rien ne se passe.",
			"La formule se perd dans le vide.",
			"L'anomalie résiste.",
			"Les mots s'éteignent sans effet.",
		],
		sent: "La formule résonne…",
		howler: "Le cri du Hurleur couvre les incantations des autres espèces",
		reasons: {
			"wrong-words": "Aucune anomalie présente ne répond à cette formule.",
			"out-of-range": "Trop loin : rapprochez-vous.",
			blocked: "Un obstacle coupe la ligne vers l'anomalie.",
			"missing-occult":
				"Tenez en main l'objet occulte de cette anomalie : sa recette est dans le grimoire.",
			"howler-scream": "Le cri du Hurleur couvre votre voix !",
			interrupted: "Incantation interrompue : reprenez votre souffle.",
			"no-voice": "Aucune voix détectée : prononcez la formule à voix haute.",
			dead: "Vous êtes hors de combat.",
			hidden: "Impossible d'incanter depuis une cachette.",
			cooldown: "Patientez un instant.",
			scattered: "Le Roi de rats est éparpillé : attendez qu'il se reforme.",
		} satisfies Record<CastFailureReason, string>,
	},
	dev: {
		title: "Dev · transcription vocale",
		live: "En direct :",
		liveMatch: "✔ formule reconnue",
		empty: "Parlez : le micro écoute en continu les formules du grimoire.",
		expected: "attendu",
		heard: "Entendu :",
		alternative: "Variante :",
		matches: (label: string) => `✔ Formule de ${label}`,
		noMatch: "✘ Ne correspond à aucune formule du grimoire",
		ignored: "Rien n'est envoyé au serveur",
		pending: "Réponse du serveur…",
		captured: "Serveur : capture réussie",
		refused: (reason: string) => `Serveur : refus — ${reason}`,
	},
	walkie: {
		idle: (key: string) => `Talkie : maintenez ${key} pour parler`,
		talking: "Talkie : vous émettez",
		hearing: (name: string) => `Talkie : ${name}`,
		taken: "Talkie récupéré : ceux qui en ont un vous entendent partout",
	},
	camera: {
		taken: (key: string) =>
			`Appareil photo récupéré : ${key} pour le lever et viser`,
		lowered: (key: string) => `Appareil photo : ${key} pour viser`,
		raised: (key: string, count: number, max: number) =>
			`${key} : photo (${count}/${max})`,
		full: (max: number) => `Pellicule pleine : ${max} photos au maximum`,
	},
	fragmentsLost: (count: number) =>
		count > 1
			? `La chute vous coûte ${count} fragments`
			: "La chute vous coûte 1 fragment",
	stakeResult: {
		sanctuary: "Le sanctuaire vous soigne… et sonne l'appel",
		reliquary: "Reliquaire pillé : tout le manoir l'a entendu, fuyez !",
		pact: "Pacte scellé : un objet occulte contre votre sang",
	},
	highlights: {
		title: "Meilleurs moments",
		counter: (index: number, total: number) => `${index} / ${total}`,
		next: "Suivant",
		skip: "Passer tout",
		voice: "Micro",
		someone: "quelqu'un",
		unknownSpecies: "une anomalie",
		speciesName: (name: string) => name.charAt(0).toLowerCase() + name.slice(1),
		moments: {
			scream: ({ name, species }) =>
				`${name} hurle à pleins poumons avec ${species} aux trousses`,
			fall: ({ name, value }) =>
				`${name} tombe de ${String(value).replace(".", ",")} m et le regrette`,
			fallDeath: ({ name, value }) =>
				`${name} tente une chute de ${String(value).replace(".", ",")} m. Le sol gagne.`,
			betrayed: ({ name, other, species }) =>
				`${other} pousse ${name}, et ${species} s'occupe du reste`,
			extracted: ({ name, species }) =>
				`${name} se croyait à l'abri, mais ${species} a trouvé la cachette`,
			radioBetrayal: ({ name, species }) =>
				`Le talkie de ${name} grésille au pire moment : ${species} l'entend`,
			explosion: ({ name, species, value }) =>
				value > 1
					? `${species} explose et emporte ${value} joueurs`
					: `${species} explose au visage de ${name}`,
			carried: ({ name, species }) =>
				`${species} embarque ${name} sans demander`,
			thrown: ({ name, species }) =>
				`${species} envoie ${name} à travers la pièce`,
			death: ({ name, species }) => `${species} finit par rattraper ${name}`,
			pact: ({ name }) =>
				`${name} signe un pacte et y laisse la moitié de sa vie`,
			pactDeath: ({ name }) => `${name} signe un pacte trop cher pour sa santé`,
			heist: ({ name }) =>
				`${name} pille le reliquaire et réveille tout le manoir`,
			clutch: ({ name, species }) =>
				`${name} capture ${species} à la toute dernière seconde`,
			capture: ({ name, species }) => `${name} capture ${species}`,
			escape: ({ name, species, value }) =>
				`${name} sème ${species} après ${Math.round(value / 1000)} s de poursuite`,
			doubleChat: ({ name, other }) =>
				`${name} discute tranquillement avec un faux ${other}`,
		} satisfies Record<
			HighlightKind,
			(context: HighlightContext) => string
		> as Record<HighlightKind, (context: HighlightContext) => string>,
	},
	awards: {
		title: "Titres de la partie",
		names: {
			abandoner: "A abandonné ses amis",
			hider: "Champion de cache-cache",
			screamer: "Cordes vocales en feu",
			gravity: "Gravité 1, vous 0",
			traitor: "Mauvais camarade",
			gambler: "Joueur invétéré",
			radioHost: "Animateur radio",
			prey: "Proie préférée",
			hunter: "Chasseur émérite",
			martyr: "Abonné au cimetière",
			doorman: "Concierge du manoir",
			bunny: "Lapin sous caféine",
			marathon: "Marathonien",
			collector: "Ramasse-miettes",
			lighthouse: "Phare humain",
			tourist: "Touriste",
		} satisfies Record<AwardId, string> as Record<AwardId, string>,
		details: {
			abandoner: (value) =>
				`${value} ami${value > 1 ? "s" : ""} laissé${value > 1 ? "s" : ""} derrière`,
			hider: (value) => `${seconds(value)} s sans sortir de sa cachette`,
			screamer: (value) => `${seconds(value)} s de hurlements`,
			gravity: (value) => `${value} PV perdus en tombant`,
			traitor: (value) => `${value} joueurs poussés`,
			gambler: (value) =>
				`${value} pacte${value > 1 ? "s" : ""} signé${value > 1 ? "s" : ""}`,
			radioHost: (value) => `${seconds(value)} s d'antenne`,
			prey: (value) => `${seconds(value)} s de poursuite`,
			hunter: (value) => `${value} captures`,
			martyr: (value) => `${value} morts`,
			doorman: (value) => `${value} portes manœuvrées`,
			bunny: (value) => `${value} sauts`,
			marathon: (value) => `${Math.round(value)} m au sprint`,
			collector: (value) => `${value} fragments`,
			lighthouse: (value) => `${seconds(value)} s de lanterne ouverte`,
			tourist: () => "A surtout admiré la décoration",
		} satisfies Record<AwardId, (value: number) => string> as Record<
			AwardId,
			(value: number) => string
		>,
	},
	hud: {
		awakening: (seconds: number) =>
			`Les anomalies s'éveillent dans ${seconds} s`,
		petrified: "Pétrifié par la Pleureuse !",
		noise: "Bruit",
		noiseQuiet: "Discret",
		noiseHeard: "Audible",
		push: "Pousser",
		shout: "Cri",
		grimoire: "Grimoire",
		fallen: "Vous êtes tombé",
		lookAway: "Détournez le regard !",
		respawn: (seconds: number) => `Réapparition dans ${seconds} s`,
		fps: (fps: number) => `${fps} i/s`,
	},
	pause: {
		title: "La chasse continue",
		text: "Le pointeur est libéré : votre champignon reste dans le manoir et peut être attaqué.",
		resume: "Reprendre",
		exitFullscreen: "Quitter le plein écran",
		fullscreen: "Plein écran",
		settings: "Paramètres",
		leave: "Quitter la partie",
		keyboardLock:
			"En plein écran, les raccourcis du navigateur comme Ctrl+W sont capturés par le jeu.",
		noKeyboardLock:
			"Votre navigateur ne permet pas de capturer Ctrl+W : remappez l'accroupissement si besoin.",
	},
	map: {
		title: "Plan du manoir",
		levelName: (level: number) =>
			level === 0 ? "Rez-de-chaussée" : `Étage ${level}`,
		recenter: "Recentrer (0)",
		close: "Fermer (M)",
		footer:
			"Molette ou +/− : zoom · Glisser ou flèches : déplacer · 0 : recentrer · M ou Échap : fermer · Les anomalies n'apparaissent jamais sur le plan.",
		north: "N",
		legend: {
			you: "Vous",
			players: "Autres joueurs",
			current: "Salle actuelle",
			door: "Porte",
			window: "Vitre",
			stairs: "Escalier",
			elsewhere: "Joueur à un autre étage",
		},
	},
	leaderboard: {
		title: "Classement",
		mushroom: "Champignon",
		points: "Points",
		health: "Vie",
		energy: "Énergie",
		you: "vous",
		down: "à terre",
	},
	results: {
		kicker: "Fin de la chasse",
		title: "La récolte est terminée",
		winner: (name: string, points: string) =>
			`${name} remporte la chasse avec ${points} points !`,
		noWinner: "Aucun vainqueur : égalité parfaite ou récolte vide.",
		teamWinner: (team: string, points: string) =>
			`${team} remportent la chasse avec ${points} points !`,
		captures: (count: number) => `${count} capture${count > 1 ? "s" : ""}`,
		deaths: (count: number) => `${count} chute${count > 1 ? "s" : ""}`,
		saved: (email: string) =>
			`Partie enregistrée dans l'historique du compte ${email}.`,
		unlocked: (names: string) => `Récompense débloquée : ${names} !`,
		photos: {
			title: (count: number) =>
				count > 1 ? `Vos ${count} photos` : "Votre photo",
			download: "Télécharger cette photo",
			downloadAll: "Tout télécharger",
			alt: (index: number) => `Photo ${index} de la partie`,
			note: "Cliquez sur une photo pour la télécharger. Elles restent dans votre navigateur et disparaissent au lancement de la partie suivante.",
		},
		backToLobby: "Retour au lobby",
		home: "Accueil",
	},
	loading: {
		kicker: "Ouverture du manoir",
		waiting: "En attente des autres joueurs…",
		preparing: "Préparation…",
		back: "Retour à l'accueil",
		hint: "Astuce : le grimoire (G) se feuillette à la molette et aux flèches.",
		failed: (message: string) => `Chargement impossible : ${message}`,
		genericError: "Erreur de chargement",
		layoutUnavailable: "Plan du manoir indisponible",
		layoutOtherMatch: "Plan reçu pour une autre partie",
		layoutMismatch: "Plan du manoir incohérent",
		steps: {
			manor: "Génération du manoir",
			collisions: "Collisions et plan",
			textures: "Textures pixelisées",
			architecture: "Maçonnerie et mobilier",
			models: "Champignons et anomalies",
			grimoire: "Grimoire et illustrations",
			audio: "Sons et ambiance",
			gpu: "Préparation du GPU (shaders)",
		} satisfies Record<LoadStepId, string>,
	},
	aborted: {
		"all-left": "Tous les joueurs ont quitté la partie.",
		"all-disconnected": "Tous les joueurs se sont déconnectés.",
		"layout-mismatch": "Plan du manoir incohérent.",
	} satisfies Record<AbortReason, string>,
	mic: {
		status: {
			idle: "Le microphone n'a pas encore été vérifié.",
			requesting:
				"Autorisez l'accès au microphone dans la fenêtre du navigateur.",
			ready: "Microphone opérationnel.",
			denied:
				"Accès refusé. Autorisez le microphone pour ce site (icône du cadenas dans la barre d'adresse), puis réessayez.",
			"no-device":
				"Aucune entrée audio détectée. Branchez un microphone puis réessayez.",
			lost: "Le microphone a été déconnecté. Rebranchez-le ou choisissez un autre périphérique.",
			unsupported:
				"Ce navigateur ne permet pas l'accès au microphone (HTTPS ou localhost requis).",
			silent:
				"Le microphone ne transmet aucun son. Vérifiez qu'il n'est pas coupé.",
			error: "Impossible d'ouvrir le microphone.",
		} satisfies Record<MicStatus, string>,
		device: (index: number) => `Microphone ${index}`,
		fallbackLabel: "Microphone",
	},
	speech: {
		unavailable:
			"Reconnaissance vocale indisponible dans ce navigateur : incantez avec Chrome, Edge ou Safari.",
		failedToStart: "La reconnaissance vocale n'a pas pu démarrer.",
		loading:
			"La reconnaissance vocale se charge encore (un modèle d'environ 40 Mo au premier lancement) : réessayez dans quelques secondes.",
		generic: "Erreur de reconnaissance vocale.",
		errors: {
			"not-allowed":
				"La reconnaissance vocale a été refusée par le navigateur.",
			"service-not-allowed":
				"Le service de reconnaissance vocale est indisponible.",
			network:
				"La reconnaissance vocale nécessite une connexion réseau dans ce navigateur.",
			"no-speech": "Aucune parole détectée.",
			"audio-capture":
				"Le microphone n'a pas pu être utilisé pour la reconnaissance.",
			aborted: "Incantation annulée.",
			"language-not-supported":
				"Le français n'est pas pris en charge par la reconnaissance vocale de ce navigateur.",
		} as Record<string, string>,
	},
};

export const gameEn: typeof gameFr = {
	interaction: {
		leave: (place: string) => `${place}: Get out`,
		leaveShort: "Get out",
		hide: (place: string) => `${place}: Hide`,
		openDoor: "Open the door",
		closeDoor: "Close the door",
		valveActive: "Green water flowing",
		valveResting: "Valve resting…",
		openValve: "Open the green water valve",
		pickUp: (name: string) => `Pick up: ${name}`,
		pickUpAny: "Pick up a material",
		search: {
			chest: "Search the chest",
			crate: "Search the crate",
			smallBox: "Search the box",
		},
		useAltar: "Use the altar",
		craft: (name: string) => `Craft: ${name}`,
		missingMaterials: "Materials missing: close",
		takeWalkie: "Take the walkie-talkie",
		takeCamera: "Take the camera",
		stakeResting: "The flame is out: come back later",
		stakes: {
			sanctuary: "Sanctuary: heals, but draws the anomalies",
			reliquary: "Reliquary: 4 fragments, but the alarm rings",
			pact: "Pact: 50 HP for an occult object",
		},
	},
	inventory: {
		title: "Fragments",
		handEmpty: "Empty hand",
	},
	altar: {
		title: "Occult altar",
		hint: "Wheel or number: pick an object. Each capture uses up one object.",
	},
	tutorial: {
		progress: (step: number, total: number) => `Step ${step} of ${total}`,
		skip: "Enter: skip this step",
		checks: {
			range: (meters: number) => `Within ${meters} m of the monster`,
			object: "Occult object in hand",
			voice: "Voice heard by the microphone",
			valveOpen: "Valve open",
			inJet: "Under the jet",
		},
		steps: {
			move: (keys: string) => ({
				title: "Moving",
				body: `${keys} to walk, the mouse to look. The minimap shows where you are. Walk a little.`,
			}),
			sprint: (sprint: string, jump: string) => ({
				title: "Running and jumping",
				body: `Hold ${sprint} while walking to run, ${jump} to jump. Running, jumping and keeping the lantern open drain the yellow energy bar. Once empty, no more running or jumping until it has refilled, and a fall from a mezzanine hurts. Run for a moment.`,
			}),
			crouch: (crouch: string) => ({
				title: "Staying quiet",
				body: `Hold ${crouch} to crouch. Running can be heard from afar, crouching hardly at all. With the lantern closed, the noise gauge appears: your voice on the mic draws monsters too.`,
			}),
			lantern: (key: string) => ({
				title: "The lantern",
				body: `${key} opens or closes the lantern. It gives light, but monsters see it from afar. Try it.`,
			}),
			door: (key: string) => ({
				title: "Doors",
				body: `Follow the star, aim at a door and press ${key}.`,
			}),
			map: (key: string) => ({
				title: "The map",
				body: `${key} opens the manor plan: rooms, floors, stairs and altars. Open it, then close it with ${key}.`,
			}),
			loot: (key: string, list: string) => ({
				title: "Materials",
				body: `Pieces of objects lie on the floor, on furniture, in chests and boxes. Follow the star and pick up with ${key}: ${list}.`,
			}),
			grimoire: (key: string) => ({
				title: "The grimoire",
				body: `${key} opens the grimoire; look down to read it. Each monster has its page: the occult object to craft, the conditions and the formula. The wheel turns the pages.`,
			}),
			altar: (key: string, name: string) => ({
				title: "The altar",
				body: `Lecterns with a flying book, shown by a turquoise star on the minimap, craft occult objects. Reach one, press ${key}, pick "${name}" with the wheel, then ${key} again.`,
			}),
			hold: (name: string) => ({
				title: "Holding the object",
				body: `To capture, the object must be in your hand. Select "${name}" in the bottom bar, with the wheel or its number.`,
			}),
			hide: (key: string) => ({
				title: "Hiding",
				body: `Wardrobes, trunks and other hiding places protect you from monsters. Enter the marked one with ${key}, then come back out.`,
			}),
			valve: (key: string, flow: number, rest: number) => ({
				title: "Green water",
				body: `You are hurt: look at the red bar. Green water heals. Follow the star to a valve, taking the stairs if needed, open it with ${key} and stand under the jet. It flows for ${flow} s, then rests for ${rest} s.`,
			}),
			push: (key: string) => ({
				title: "Pushing",
				body: `${key} pushes the player in front of you and interrupts their incantation. It costs energy and has to recharge: look at the bottom right. Try it.`,
			}),
			shout: (key: string) => ({
				title: "Shouting",
				body: `A Whisper has just awoken. A shout draws monsters to where you stand: press ${key} to bring it here.`,
			}),
			capture: (formula: string) => ({
				title: "Capturing",
				body: `Within 5 m, with the occult object in hand: say "${formula}" out loud. Lantern open or closed, it does not matter, and no need to aim.`,
			}),
			end: () => ({
				title: "You are ready",
				body: `In a real game, monsters really hurt, and you come back a few seconds after falling. A shout or a loud voice also interrupts a rival's incantation. Press Enter to return home.`,
			}),
		},
	},
	cast: {
		noSpeech:
			"Speech recognition unavailable in this browser: cast with Chrome, Edge or Safari.",
		captured: (label: string) => `${label} captured!`,
		failed: [
			"Nothing happens.",
			"The formula fades into the void.",
			"The anomaly resists.",
			"The words die out to no effect.",
		],
		sent: "The formula echoes…",
		howler: "The Howler's scream drowns out incantations for other species",
		reasons: {
			"wrong-words": "No anomaly here answers to that formula.",
			"out-of-range": "Too far: get closer.",
			blocked: "Something blocks the line to the anomaly.",
			"missing-occult":
				"Hold this anomaly's occult object in your hand: its recipe is in the grimoire.",
			"howler-scream": "The Howler's scream drowns out your voice!",
			interrupted: "Incantation interrupted: catch your breath.",
			"no-voice": "No voice detected: say the formula out loud.",
			dead: "You are out of action.",
			hidden: "You cannot cast from a hiding place.",
			cooldown: "Wait a moment.",
			scattered:
				"The Rat King is scattered: wait for it to knot back together.",
		},
	},
	dev: {
		title: "Dev · speech transcript",
		live: "Live:",
		liveMatch: "✔ formula recognised",
		empty: "Speak: the microphone listens continuously for grimoire formulas.",
		expected: "expected",
		heard: "Heard:",
		alternative: "Alternative:",
		matches: (label: string) => `✔ ${label}'s formula`,
		noMatch: "✘ Matches no formula in the grimoire",
		ignored: "Nothing is sent to the server",
		pending: "Waiting for the server…",
		captured: "Server: capture succeeded",
		refused: (reason: string) => `Server: refused — ${reason}`,
	},
	walkie: {
		idle: (key: string) => `Walkie: hold ${key} to talk`,
		talking: "Walkie: transmitting",
		hearing: (name: string) => `Walkie: ${name}`,
		taken: "Walkie picked up: anyone holding one hears you everywhere",
	},
	camera: {
		taken: (key: string) => `Camera picked up: ${key} to raise it and aim`,
		lowered: (key: string) => `Camera: ${key} to aim`,
		raised: (key: string, count: number, max: number) =>
			`${key}: photo (${count}/${max})`,
		full: (max: number) => `Film full: ${max} photos at most`,
	},
	fragmentsLost: (count: number) =>
		count > 1
			? `The fall costs you ${count} fragments`
			: "The fall costs you 1 fragment",
	stakeResult: {
		sanctuary: "The sanctuary heals you… and calls out",
		reliquary: "Reliquary looted: the whole manor heard it, run!",
		pact: "Pact sealed: an occult object for your blood",
	},
	highlights: {
		title: "Best moments",
		counter: (index: number, total: number) => `${index} / ${total}`,
		next: "Next",
		skip: "Skip all",
		voice: "Mic",
		someone: "someone",
		unknownSpecies: "an anomaly",
		speciesName: (name: string) => name.charAt(0).toLowerCase() + name.slice(1),
		moments: {
			scream: ({ name, species }) =>
				`${name} screams at the top of their lungs with ${species} right behind`,
			fall: ({ name, value }) => `${name} falls ${value} m and regrets it`,
			fallDeath: ({ name, value }) =>
				`${name} attempts a ${value} m drop. The floor wins.`,
			betrayed: ({ name, other, species }) =>
				`${other} shoves ${name}, and ${species} does the rest`,
			extracted: ({ name, species }) =>
				`${name} felt safe, but ${species} found the hiding spot`,
			radioBetrayal: ({ name, species }) =>
				`${name}'s walkie crackles at the worst moment: ${species} hears it`,
			explosion: ({ name, species, value }) =>
				value > 1
					? `${species} explodes and takes ${value} players along`
					: `${species} explodes in ${name}'s face`,
			carried: ({ name, species }) => `${species} carries ${name} away`,
			thrown: ({ name, species }) => `${species} sends ${name} across the room`,
			death: ({ name, species }) => `${species} finally catches ${name}`,
			pact: ({ name }) => `${name} signs a pact and loses half their life`,
			pactDeath: ({ name }) =>
				`${name} signs a pact too costly for their health`,
			heist: ({ name }) =>
				`${name} loots the reliquary and wakes the whole manor`,
			clutch: ({ name, species }) =>
				`${name} captures ${species} at the very last second`,
			capture: ({ name, species }) => `${name} captures ${species}`,
			escape: ({ name, species, value }) =>
				`${name} shakes off ${species} after a ${Math.round(value / 1000)} s chase`,
			doubleChat: ({ name, other }) =>
				`${name} calmly chats with a fake ${other}`,
		},
	},
	awards: {
		title: "Match titles",
		names: {
			abandoner: "Left their friends behind",
			hider: "Hide-and-seek champion",
			screamer: "Vocal cords on fire",
			gravity: "Gravity 1, you 0",
			traitor: "Bad teammate",
			gambler: "Compulsive gambler",
			radioHost: "Radio host",
			prey: "Favourite prey",
			hunter: "Expert hunter",
			martyr: "Graveyard regular",
			doorman: "Manor doorman",
			bunny: "Caffeinated bunny",
			marathon: "Marathon runner",
			collector: "Crumb collector",
			lighthouse: "Human lighthouse",
			tourist: "Tourist",
		},
		details: {
			abandoner: (value) =>
				`${value} friend${value > 1 ? "s" : ""} left behind`,
			hider: (value) => `${seconds(value)} s without leaving the hiding spot`,
			screamer: (value) => `${seconds(value)} s of screaming`,
			gravity: (value) => `${value} HP lost by falling`,
			traitor: (value) => `${value} players shoved`,
			gambler: (value) => `${value} pact${value > 1 ? "s" : ""} signed`,
			radioHost: (value) => `${seconds(value)} s on air`,
			prey: (value) => `${seconds(value)} s of being chased`,
			hunter: (value) => `${value} captures`,
			martyr: (value) => `${value} deaths`,
			doorman: (value) => `${value} doors worked`,
			bunny: (value) => `${value} jumps`,
			marathon: (value) => `${Math.round(value)} m sprinted`,
			collector: (value) => `${value} fragments`,
			lighthouse: (value) => `${seconds(value)} s of open lantern`,
			tourist: () => "Mostly admired the decor",
		},
	},
	hud: {
		awakening: (seconds: number) => `The anomalies awaken in ${seconds} s`,
		petrified: "Turned to stone by the Weeper!",
		noise: "Noise",
		noiseQuiet: "Quiet",
		noiseHeard: "Audible",
		push: "Push",
		shout: "Shout",
		grimoire: "Grimoire",
		fallen: "You have fallen",
		lookAway: "Look away!",
		respawn: (seconds: number) => `Respawning in ${seconds} s`,
		fps: (fps: number) => `${fps} fps`,
	},
	pause: {
		title: "The hunt goes on",
		text: "The pointer is released: your mushroom stays in the manor and can be attacked.",
		resume: "Resume",
		exitFullscreen: "Exit fullscreen",
		fullscreen: "Fullscreen",
		settings: "Settings",
		leave: "Leave the game",
		keyboardLock:
			"In fullscreen, browser shortcuts such as Ctrl+W are captured by the game.",
		noKeyboardLock:
			"Your browser cannot capture Ctrl+W: remap crouching if needed.",
	},
	map: {
		title: "Manor map",
		levelName: (level: number) =>
			level === 0 ? "Ground floor" : `Floor ${level}`,
		recenter: "Recenter (0)",
		close: "Close (M)",
		footer:
			"Wheel or +/−: zoom · Drag or arrows: move · 0: recenter · M or Esc: close · Anomalies never appear on the map.",
		north: "N",
		legend: {
			you: "You",
			players: "Other players",
			current: "Current room",
			door: "Door",
			window: "Window",
			stairs: "Stairs",
			elsewhere: "Player on another floor",
		},
	},
	leaderboard: {
		title: "Leaderboard",
		mushroom: "Mushroom",
		points: "Points",
		health: "Health",
		energy: "Energy",
		you: "you",
		down: "down",
	},
	results: {
		kicker: "End of the hunt",
		title: "The harvest is over",
		winner: (name: string, points: string) =>
			`${name} wins the hunt with ${points} points!`,
		noWinner: "No winner: a perfect tie or an empty harvest.",
		teamWinner: (team: string, points: string) =>
			`${team} win the hunt with ${points} points!`,
		captures: (count: number) => `${count} capture${count === 1 ? "" : "s"}`,
		deaths: (count: number) => `${count} fall${count === 1 ? "" : "s"}`,
		saved: (email: string) => `Game saved to the history of account ${email}.`,
		unlocked: (names: string) => `Reward unlocked: ${names}!`,
		photos: {
			title: (count: number) =>
				count > 1 ? `Your ${count} photos` : "Your photo",
			download: "Download this photo",
			downloadAll: "Download all",
			alt: (index: number) => `Photo ${index} of the game`,
			note: "Click a photo to download it. They stay in your browser and are gone once the next game starts.",
		},
		backToLobby: "Back to lobby",
		home: "Home",
	},
	loading: {
		kicker: "Opening the manor",
		waiting: "Waiting for the other players…",
		preparing: "Preparing…",
		back: "Back to home",
		hint: "Tip: flip through the grimoire (G) with the wheel and the arrows.",
		failed: (message: string) => `Loading failed: ${message}`,
		genericError: "Loading error",
		layoutUnavailable: "Manor map unavailable",
		layoutOtherMatch: "Map received for another game",
		layoutMismatch: "Inconsistent manor map",
		steps: {
			manor: "Generating the manor",
			collisions: "Collisions and map",
			textures: "Pixel textures",
			architecture: "Masonry and furniture",
			models: "Mushrooms and anomalies",
			grimoire: "Grimoire and illustrations",
			audio: "Sounds and ambience",
			gpu: "Preparing the GPU (shaders)",
		},
	},
	aborted: {
		"all-left": "All players left the game.",
		"all-disconnected": "All players disconnected.",
		"layout-mismatch": "Inconsistent manor map.",
	},
	mic: {
		status: {
			idle: "The microphone has not been checked yet.",
			requesting: "Allow microphone access in the browser prompt.",
			ready: "Microphone working.",
			denied:
				"Access denied. Allow the microphone for this site (padlock icon in the address bar), then retry.",
			"no-device": "No audio input detected. Plug in a microphone, then retry.",
			lost: "The microphone was disconnected. Plug it back in or choose another device.",
			unsupported:
				"This browser does not allow microphone access (HTTPS or localhost required).",
			silent: "The microphone sends no sound. Check that it is not muted.",
			error: "Unable to open the microphone.",
		},
		device: (index: number) => `Microphone ${index}`,
		fallbackLabel: "Microphone",
	},
	speech: {
		unavailable:
			"Speech recognition unavailable in this browser: cast with Chrome, Edge or Safari.",
		failedToStart: "Speech recognition could not start.",
		loading:
			"Speech recognition is still loading (a model of about 40 MB on first launch): try again in a few seconds.",
		generic: "Speech recognition error.",
		errors: {
			"not-allowed": "Speech recognition was refused by the browser.",
			"service-not-allowed": "The speech recognition service is unavailable.",
			network:
				"Speech recognition requires a network connection in this browser.",
			"no-speech": "No speech detected.",
			"audio-capture": "The microphone could not be used for recognition.",
			aborted: "Incantation cancelled.",
			"language-not-supported":
				"English is not supported by this browser's speech recognition.",
		},
	},
};
