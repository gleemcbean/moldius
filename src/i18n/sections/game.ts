import type { AwardId } from "@shared/awards";
import type { BrewEffect } from "@shared/manor/brews";
import type { HighlightKind } from "@shared/protocol/game";

export interface HighlightContext {
	name: string;
	other: string;
	species: string;
	value: number;
}

function lowerFirst(value: string): string {
	return value.charAt(0).toLowerCase() + value.slice(1);
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
		objectUnused: "Aucun monstre de cette partie ne le craint : refermer",
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
		close: (keys: string) => `${keys} : fermer`,
		unused: "Inutile dans cette partie",
	},
	tutorial: {
		dummyName: "Mannequin",
		skip: (key: string) => `${key} : passer l'étape`,
		stepDone: "Étape réussie !",
		teleported: "Direction la salle d'exercice…",
		castCompleted:
			"Trop tard : le mannequin a achevé son incantation. Il recommence, criez plus tôt !",
		forkHeader: "Tutoriel principal terminé",
		endHeader: "Tutoriel terminé",
		chapters: {
			movement: "Déplacements",
			items: "Objets et interface",
			interactions: "Interactions",
			capture: "Capture",
			bonus: "Pour aller plus loin",
		},
		progress: (chapter: string, step: number, total: number) =>
			`${chapter} · ${step}/${total}`,
		choices: {
			quit: "Revenir à l'accueil",
			more: "Aller plus loin : salles spéciales, talkies-walkies et appareil photo",
		},
		badges: {
			heard: "Il vous entend !",
			quiet: "Il n'entend rien",
			casting: "Incantation…",
			interrupted: "Incantation brisée !",
			completed: "Incantation achevée",
		},
		checks: {
			walk: (percent: number) => `Marcher quelques mètres (${percent} %)`,
			sprint: (key: string, percent: number) =>
				`Courir en maintenant ${key} (${percent} %)`,
			jump: (key: string) => `Sauter avec ${key}`,
			heardStanding: "Vous faire entendre en marchant debout",
			sneak: (key: string, meters: number, percent: number) =>
				`Avancer accroupi (${key}) à moins de ${meters} m sans être entendu (${percent} %)`,
			mapOpened: "Carte ouverte",
			mapClosed: "Carte refermée",
			lanternOpened: "Lanterne ouverte",
			lanternClosed: "Lanterne refermée",
			material: (name: string, have: number, need: number) =>
				`${name} : ${have}/${need}`,
			crafted: (object: string) => `« ${object} » fabriqué à l'autel`,
			held: (object: string) => `« ${object} » en main`,
			valveOpen: "Vanne ouverte",
			inJet: "Sous le jet",
			healed: (health: number, target: number) => `Santé : ${health}/${target}`,
			pushed: (key: string) => `Pousser le mannequin avec ${key}`,
			shoutRange: (meters: number) =>
				`À moins de ${String(meters).replace(".", ",")} m du mannequin`,
			interrupted: (key: string) => `Briser son incantation en criant (${key})`,
			grimoire: (key: string) => `Lire le grimoire (${key}) quelques secondes`,
			range: (meters: number) => `À moins de ${meters} m du monstre`,
			object: (object: string) => `« ${object} » en main`,
			voice: "Voix entendue par le micro",
			pact: "Pacte scellé",
			sanctuary: "Sanctuaire allumé",
			regained: (gained: number, target: number) =>
				`Reprendre des forces (+${gained}/${target} PV)`,
			reliquary: "Reliquaire pillé",
			walkieTaken: (key: string) => `Prendre le talkie-walkie (${key})`,
			radio: (key: string, percent: number) =>
				`Émettre en maintenant ${key} (${percent} %)`,
			cameraTaken: (key: string) => `Prendre l'appareil photo (${key})`,
			cameraRaised: (key: string) => `Lever l'appareil avec ${key}`,
			photo: (key: string) => `Prendre une photo (${key})`,
		},
		steps: {
			move: (keys: string) => ({
				title: "Se déplacer",
				body: `${keys} pour marcher, la souris pour regarder autour de vous. En haut à gauche, la minicarte suit chacun de vos pas. Faites quelques mètres.`,
			}),
			run: (sprint: string, jump: string) => ({
				title: "Courir et sauter",
				body: `Maintenez ${sprint} en avançant pour courir, et ${jump} pour sauter. Les deux puisent dans la barre jaune d'énergie, en bas à gauche : à sec, plus de course ni de saut le temps qu'elle remonte. Elle se recharge dès que vous soufflez un peu.`,
			}),
			stealth: (crouch: string, name: string) => ({
				title: "Rester discret",
				body: `Les monstres vous voient, mais surtout ils vous entendent. ${name} est figé pour l'exercice : son badge dit s'il vous entend. Courir s'entend de très loin, marcher à quelques mètres, et accroupi (${crouch} maintenu) presque plus rien. Votre voix au micro porte aussi : accroupi et lanterne fermée, une jauge de bruit s'affiche à droite. Approchez-le debout, puis tournez autour de lui accroupi sans vous faire entendre.`,
			}),
			map: (key: string) => ({
				title: "La carte",
				body: `${key} déplie le plan du manoir : les pièces, votre position, les autels (étoile turquoise) et les vannes d'eau verte. La molette zoome. Ouvrez-le, puis refermez-le avec ${key}.`,
			}),
			lantern: (key: string) => ({
				title: "La lanterne",
				body: `${key} ouvre ou ferme la lanterne. Elle éclaire les coins sombres, mais consomme de l'énergie tant qu'elle reste ouverte, et les monstres la repèrent de loin. Ouvrez-la, puis refermez-la.`,
			}),
			fragments: (key: string, object: string) => ({
				title: "Les fragments",
				body: `Pour capturer un monstre, il faut l'objet occulte qu'il craint, ici « ${object} ». Pour le fabriquer, il faut des fragments : ils traînent au sol, sur les meubles et dans les coffres. Suivez l'étoile et ramassez-les avec ${key}. Vos réserves s'affichent en haut à droite.`,
			}),
			altar: (key: string, object: string) => ({
				title: "L'autel",
				body: `Les pupitres au livre volant sont des autels. Suivez l'étoile, appuyez sur ${key}, choisissez « ${object} » à la molette, puis ${key} encore pour le fabriquer. Sélectionnez-le ensuite dans la barre du bas, à la molette ou avec son chiffre : pour capturer, l'objet doit être en main.`,
			}),
			water: (key: string, flow: number, rest: number) => ({
				title: "L'eau verte",
				body: `Aïe, vous voilà blessé : regardez la barre rouge. L'eau verte soigne. Suivez l'étoile jusqu'à une vanne, ouvrez-la avec ${key} et placez-vous sous le jet. Elle coule ${flow} s, puis se repose ${rest} s.`,
			}),
			push: (key: string) => ({
				title: "Pousser",
				body: `Ce mannequin joue un adversaire. ${key} pousse le joueur que vous visez de près : utile pour lui couper la route ou le jeter dans les bras d'un monstre. Une poussée coûte de l'énergie et se recharge en quelques secondes (en bas à droite). Poussez-le.`,
			}),
			shout: (key: string, name: string) => ({
				title: "Crier",
				body: `Le mannequin incante pour capturer un monstre avant vous ! Approchez-vous : un cri (${key}) brise les incantations des joueurs proches, tout comme une voix très forte au micro. En partie, chaque cri porte loin et attire les monstres vers vous ; ici, seul un cri réussi réveillera ${lowerFirst(name)}, qui rôde non loin. Criez pendant qu'il incante.`,
			}),
			goal: (points: number, key: string, name: string) => ({
				title: "Le but du jeu",
				body: `Votre cri a réveillé ${lowerFirst(name)} : le voilà ! En partie, le manoir grouille de monstres. Capturez-en le plus possible avant la fin du temps : chaque capture rapporte des points (jusqu'à ${points} pour les plus redoutables) et le meilleur score l'emporte. Le grimoire a une page par espèce : l'objet qu'elle craint, ses dangers et sa formule de capture. Ouvrez-le avec ${key}, regardez vers le bas et lisez-le.`,
			}),
			capture: (name: string, meters: number, formula: string) => ({
				title: "Capturer",
				body: `${name} est là. Approchez-vous à moins de ${meters} m, l'objet occulte en main, et prononcez à voix haute « ${formula} ». Inutile de viser. Ici, ses coups ne blessent pas ; en partie, ils font très mal.`,
			}),
			fork: (points: number) => ({
				title: "Bien joué !",
				body: `Capture réussie : +${points} points ! Vous connaissez tout le cycle : fragments, autel, objet en main, formule. Vous pouvez revenir à l'accueil pour jouer, ou découvrir encore quelques outils du manoir.`,
			}),
			pact: (key: string, cost: number) => ({
				title: "Salle spéciale : le pacte",
				body: `Certaines pièces proposent un marché risqué. L'autel rouge du pacte échange ${cost} points de vie contre un objet occulte, sans le moindre fragment. Pratique… si vous survivez. Approchez-vous et scellez le pacte avec ${key}.`,
			}),
			sanctuary: (key: string, seconds: number) => ({
				title: "Salle spéciale : le sanctuaire",
				body: `Le feu vert du sanctuaire soigne tous ceux qui restent dans la pièce pendant ${seconds} s. Mais sa cloche appelle les monstres à intervalles réguliers. Allumez-le avec ${key} et restez le temps de vous refaire une santé.`,
			}),
			reliquary: (key: string, count: number) => ({
				title: "Salle spéciale : le reliquaire",
				body: `Le reliquaire doré renferme ${count} fragments pris au hasard. Le piller déclenche l'alarme : les portes claquent et tout le manoir l'entend. Pillez-le avec ${key}.`,
			}),
			walkie: (interact: string, radio: string) => ({
				title: "Le talkie-walkie",
				body: `Quelques talkies-walkies traînent dans le manoir. Prenez celui-ci avec ${interact}, puis maintenez ${radio} pour parler : tous ceux qui en portent un vous entendent, où qu'ils soient. Attention, le haut-parleur de ceux qui écoutent grésille, et les monstres l'entendent.`,
			}),
			camera: (
				interact: string,
				camera: string,
				aim: string,
				photo: string,
			) => ({
				title: "L'appareil photo",
				body: `Prenez l'appareil photo avec ${interact}. ${camera} le lève ou le baisse, ${aim} maintenu pour viser, ${photo} pour déclencher. Vos clichés vous attendent à la fin de la partie, prêts à être téléchargés. Prenez une photo.`,
			}),
			end: () => ({
				title: "Vous êtes prêt",
				body: "Vous savez tout. Chaque espèce a ses ruses, lisez bien sa page du grimoire avant de l'affronter. Bonne chasse !",
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
			rolling:
				"Le Cinématographe tourne encore : battez-le à son propre jeu pour l'éteindre.",
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
		refused: (reason: string) => `Serveur : refus : ${reason}`,
	},
	walkie: {
		idle: (key: string) => `Talkie : maintenez ${key} pour parler`,
		talking: "Talkie : vous émettez",
		hearing: (name: string) => `Talkie : ${name}`,
		taken: "Talkie récupéré : ceux qui en ont un vous entendent partout",
	},
	camera: {
		taken: (aimKey: string, cameraKey: string) =>
			`Appareil photo récupéré : ${aimKey} maintenu pour viser, ${cameraKey} pour le lever`,
		lowered: (aimKey: string, cameraKey: string) =>
			`Appareil photo : ${aimKey} pour viser · ${cameraKey} pour le lever`,
		raised: (photoKey: string, count: number, max: number, aimKey: string) =>
			`${photoKey} : photo (${count}/${max}) · ${aimKey} : viser`,
		aiming: (photoKey: string, count: number, max: number) =>
			`Visée · ${photoKey} : photo (${count}/${max})`,
		full: (max: number) => `Pellicule pleine : ${max} photos au maximum`,
	},
	brew: {
		names: {
			nausea: "Nausée",
			feather: "Légèreté",
			haste: "Célérité",
			sluggish: "Lourdeur",
			vigor: "Vigueur",
		} satisfies Record<BrewEffect, string>,
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
		title: "Distinctions de la partie",
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
		infection: {
			infected:
				"Les spores du Cordyceps germent en vous ! Une lanterne ouverte les aurait brûlées.",
			scream: "Le champignon hurle par votre bouche !",
			lure: "Vos jambes vous portent vers une anomalie…",
			leap: "Une force vous pousse vers le vide !",
			lantern: "Vos mains ouvrent la lanterne malgré vous !",
			expel: "Le champignon vous arrache à votre cachette !",
			freed: "Une secousse : vous reprenez le contrôle !",
			cured: "Les spores se dessèchent : vous êtes guéri.",
			status: (seconds: number) => `Infecté · ${seconds} s`,
		},
		film: {
			presents: "Le Cinématographe présente",
			title: "« Le Petit Champignon »",
			jump: "Sauter",
			duck: "Se baisser",
			end: "FIN",
			endText: "Le film s'arrête là.",
			intermission: "ENTRACTE",
			intermissionText: "La machine a calé : capturez-la !",
			cut: "La séance est interrompue.",
		},
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
			enlarge: "Agrandir cette photo",
			viewer: (index: number, count: number) => `Photo ${index} sur ${count}`,
			previous: "Précédente",
			next: "Suivante",
			alt: (index: number) => `Photo ${index} de la partie`,
			note: "Cliquez sur une photo pour l'agrandir et la télécharger. Elles restent dans votre navigateur et disparaissent au lancement de la partie suivante.",
		},
		backToLobby: "Retour au lobby",
		home: "Accueil",
		duration: (minutes: number) => `${minutes} min de chasse`,
		players: (count: number) => `${count} joueur${count > 1 ? "s" : ""}`,
		standings: "Classement",
		yourGame: "Votre chasse",
		place: "Place",
		score: "Score",
		capturesLabel: "Captures",
		deathsLabel: "Chutes",
		unlocksTitle: "Débloqué pendant la partie",
		challengeTag: "Défi",
		rewardTag: "Récompense",
	},
	loading: {
		kicker: "Ouverture du manoir",
		waiting: "En attente des autres joueurs…",
		preparing: "Préparation…",
		back: "Retour à l'accueil",
		tipLabel: "Astuce",
		party: "Expédition",
		you: "vous",
		tips: [
			"Pour capturer une anomalie, tenez son objet occulte en main et prononcez sa formule à voix haute.",
			"Le grimoire se feuillette à la molette et aux flèches : chaque espèce y a sa planche et sa formule.",
			"Impossible d'incanter depuis une cachette : sortez avant de prononcer la formule.",
			"Une chute fait perdre des fragments. Un autre joueur peut vous en donner pour vous remettre en selle.",
			"Le cri du Hurleur couvre votre voix : attendez qu'il se taise pour incanter.",
			"Le Roi de rats s'éparpille : attendez qu'il se reforme avant de prononcer sa formule.",
			"Qui porte la prime est mieux senti par les anomalies, et ses rivaux gagnent des points à le pousser.",
			"Le talkie-walkie porte votre voix jusqu'aux autres joueurs, même à l'autre bout du manoir.",
			"Les défis progressent en partie publique et au mode du jour, jamais en partie privée.",
		],
		failed: (message: string) => `Chargement impossible : ${message}`,
		genericError: "Erreur de chargement",
		layoutUnavailable: "Plan du manoir indisponible",
		layoutOtherMatch: "Plan reçu pour une autre partie",
		layoutMismatch: "Plan du manoir incohérent",
		steps: {
			manor: "Génération du manoir",
			collisions: "Collisions et plan",
			textures: "Textures et modèles 3D",
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
		objectUnused: "No monster in this game fears it: close",
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
		close: (keys: string) => `${keys}: close`,
		unused: "Useless in this game",
	},
	tutorial: {
		dummyName: "Dummy",
		skip: (key: string) => `${key}: skip this step`,
		stepDone: "Step complete!",
		teleported: "Off to the training room…",
		castCompleted:
			"Too late: the dummy finished its incantation. It starts again, shout sooner!",
		forkHeader: "Main tutorial complete",
		endHeader: "Tutorial complete",
		chapters: {
			movement: "Movement",
			items: "Items and interface",
			interactions: "Interactions",
			capture: "Capture",
			bonus: "Going further",
		},
		progress: (chapter: string, step: number, total: number) =>
			`${chapter} · ${step}/${total}`,
		choices: {
			quit: "Return home",
			more: "Go further: special rooms, walkie-talkies and camera",
		},
		badges: {
			heard: "It hears you!",
			quiet: "It hears nothing",
			casting: "Incanting…",
			interrupted: "Incantation broken!",
			completed: "Incantation complete",
		},
		checks: {
			walk: (percent: number) => `Walk a few meters (${percent}%)`,
			sprint: (key: string, percent: number) =>
				`Run while holding ${key} (${percent}%)`,
			jump: (key: string) => `Jump with ${key}`,
			heardStanding: "Get heard while walking upright",
			sneak: (key: string, meters: number, percent: number) =>
				`Move crouched (${key}) within ${meters} m without being heard (${percent}%)`,
			mapOpened: "Map opened",
			mapClosed: "Map closed again",
			lanternOpened: "Lantern opened",
			lanternClosed: "Lantern closed again",
			material: (name: string, have: number, need: number) =>
				`${name}: ${have}/${need}`,
			crafted: (object: string) => `"${object}" crafted at the altar`,
			held: (object: string) => `"${object}" in hand`,
			valveOpen: "Valve open",
			inJet: "Under the jet",
			healed: (health: number, target: number) => `Health: ${health}/${target}`,
			pushed: (key: string) => `Push the dummy with ${key}`,
			shoutRange: (meters: number) => `Within ${meters} m of the dummy`,
			interrupted: (key: string) =>
				`Break its incantation with a shout (${key})`,
			grimoire: (key: string) => `Read the grimoire (${key}) for a few seconds`,
			range: (meters: number) => `Within ${meters} m of the monster`,
			object: (object: string) => `"${object}" in hand`,
			voice: "Voice heard by the microphone",
			pact: "Pact sealed",
			sanctuary: "Sanctuary lit",
			regained: (gained: number, target: number) =>
				`Recover some health (+${gained}/${target} HP)`,
			reliquary: "Reliquary looted",
			walkieTaken: (key: string) => `Take the walkie-talkie (${key})`,
			radio: (key: string, percent: number) =>
				`Transmit while holding ${key} (${percent}%)`,
			cameraTaken: (key: string) => `Take the camera (${key})`,
			cameraRaised: (key: string) => `Raise the camera with ${key}`,
			photo: (key: string) => `Take a photo (${key})`,
		},
		steps: {
			move: (keys: string) => ({
				title: "Moving around",
				body: `${keys} to walk, the mouse to look around. At the top left, the minimap follows your every step. Walk a few meters.`,
			}),
			run: (sprint: string, jump: string) => ({
				title: "Running and jumping",
				body: `Hold ${sprint} while moving to run, and press ${jump} to jump. Both draw on the yellow energy bar at the bottom left: when it runs dry, no more running or jumping until it refills. It recovers as soon as you catch your breath.`,
			}),
			stealth: (crouch: string, name: string) => ({
				title: "Staying quiet",
				body: `Monsters see you, but above all they hear you. ${name} is frozen for this exercise: its badge tells you whether it hears you. Running carries very far, walking a few meters, and crouching (hold ${crouch}) almost nothing. Your microphone voice carries too: crouched with the lantern closed, a noise gauge appears on the right. Walk up to it upright, then circle it crouched without being heard.`,
			}),
			map: (key: string) => ({
				title: "The map",
				body: `${key} unfolds the manor plan: rooms, your position, altars (turquoise star) and green water valves. The wheel zooms. Open it, then close it again with ${key}.`,
			}),
			lantern: (key: string) => ({
				title: "The lantern",
				body: `${key} opens or closes the lantern. It lights up dark corners, but drains energy while it stays open, and monsters spot it from afar. Open it, then close it again.`,
			}),
			fragments: (key: string, object: string) => ({
				title: "Fragments",
				body: `To capture a monster you need the occult object it fears, here "${object}". Crafting it takes fragments: they lie on the floor, on furniture and in chests. Follow the star and pick them up with ${key}. Your stock is shown at the top right.`,
			}),
			altar: (key: string, object: string) => ({
				title: "The altar",
				body: `Lecterns with a floating book are altars. Follow the star, press ${key}, pick "${object}" with the wheel, then ${key} again to craft it. Then select it in the bottom bar, with the wheel or its number: to capture, the object must be in your hand.`,
			}),
			water: (key: string, flow: number, rest: number) => ({
				title: "Green water",
				body: `Ouch, you are hurt: look at the red bar. Green water heals. Follow the star to a valve, open it with ${key} and stand under the jet. It flows for ${flow} s, then rests for ${rest} s.`,
			}),
			push: (key: string) => ({
				title: "Pushing",
				body: `This dummy plays a rival. ${key} pushes the player you are aiming at up close: handy to block their way or throw them into a monster's arms. A push costs energy and recharges in a few seconds (bottom right). Push it.`,
			}),
			shout: (key: string, name: string) => ({
				title: "Shouting",
				body: `The dummy is incanting to capture a monster before you! Get close: a shout (${key}) breaks the incantations of nearby players, and so does a very loud voice on the microphone. In a real game, every shout carries far and draws monsters to you; here, only a successful shout will wake ${lowerFirst(name)}, lurking nearby. Shout while it is incanting.`,
			}),
			goal: (points: number, key: string, name: string) => ({
				title: "The goal",
				body: `Your shout woke ${lowerFirst(name)}: here it comes! In a game, the manor swarms with monsters. Capture as many as you can before time runs out: each capture scores points (up to ${points} for the most fearsome) and the best score wins. The grimoire has one page per species: the object it fears, its dangers and its capture formula. Open it with ${key}, look down and read it.`,
			}),
			capture: (name: string, meters: number, formula: string) => ({
				title: "Capturing",
				body: `Get within ${meters} m of ${lowerFirst(name)}, with the occult object in hand, and say "${formula}" out loud. No need to aim. Here its blows do not hurt; in a real game, they hurt a lot.`,
			}),
			fork: (points: number) => ({
				title: "Well done!",
				body: `Capture complete: +${points} points! You know the whole cycle: fragments, altar, object in hand, formula. You can return home to play, or discover a few more tools of the manor.`,
			}),
			pact: (key: string, cost: number) => ({
				title: "Special room: the pact",
				body: `Some rooms offer a risky deal. The red pact altar trades ${cost} health points for an occult object, no fragments needed. Handy… if you survive. Step up and seal the pact with ${key}.`,
			}),
			sanctuary: (key: string, seconds: number) => ({
				title: "Special room: the sanctuary",
				body: `The sanctuary's green fire heals everyone who stays in the room for ${seconds} s. But its bell calls monsters at regular intervals. Light it with ${key} and stay until you are back on your feet.`,
			}),
			reliquary: (key: string, count: number) => ({
				title: "Special room: the reliquary",
				body: `The golden reliquary holds ${count} random fragments. Looting it sets off the alarm: doors slam and the whole manor hears it. Loot it with ${key}.`,
			}),
			walkie: (interact: string, radio: string) => ({
				title: "The walkie-talkie",
				body: `A few walkie-talkies lie around the manor. Take this one with ${interact}, then hold ${radio} to talk: everyone carrying one hears you, wherever they are. Careful, the listeners' speakers crackle, and monsters hear it.`,
			}),
			camera: (
				interact: string,
				camera: string,
				aim: string,
				photo: string,
			) => ({
				title: "The camera",
				body: `Take the camera with ${interact}. ${camera} raises or lowers it, hold ${aim} to aim, ${photo} to shoot. Your pictures wait for you at the end of the game, ready to download. Take a photo.`,
			}),
			end: () => ({
				title: "You are ready",
				body: "You know it all. Every species has its tricks, so read its grimoire page before facing it. Happy hunting!",
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
			rolling:
				"The Cinematograph is still rolling: beat it at its own game to shut it down.",
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
		refused: (reason: string) => `Server: refused: ${reason}`,
	},
	walkie: {
		idle: (key: string) => `Walkie: hold ${key} to talk`,
		talking: "Walkie: transmitting",
		hearing: (name: string) => `Walkie: ${name}`,
		taken: "Walkie picked up: anyone holding one hears you everywhere",
	},
	camera: {
		taken: (aimKey, cameraKey) =>
			`Camera picked up: hold ${aimKey} to aim, ${cameraKey} to raise it`,
		lowered: (aimKey, cameraKey) =>
			`Camera: ${aimKey} to aim · ${cameraKey} to raise it`,
		raised: (photoKey, count, max, aimKey) =>
			`${photoKey}: photo (${count}/${max}) · ${aimKey}: aim`,
		aiming: (photoKey, count, max) =>
			`Aiming · ${photoKey}: photo (${count}/${max})`,
		full: (max: number) => `Film full: ${max} photos at most`,
	},
	brew: {
		names: {
			nausea: "Nausea",
			feather: "Featherweight",
			haste: "Haste",
			sluggish: "Sluggish",
			vigor: "Vigour",
		},
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
		title: "Match honours",
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
		infection: {
			infected:
				"The Cordyceps spores take root in you! An open lantern would have burnt them.",
			scream: "The fungus screams through your mouth!",
			lure: "Your legs carry you towards an anomaly…",
			leap: "Something drives you towards the drop!",
			lantern: "Your hands open the lantern against your will!",
			expel: "The fungus drags you out of your hiding place!",
			freed: "A shove: you take back control!",
			cured: "The spores dry out: you are cured.",
			status: (seconds: number) => `Infected · ${seconds} s`,
		},
		film: {
			presents: "The Cinematograph presents",
			title: "“The Little Mushroom”",
			jump: "Jump",
			duck: "Duck",
			end: "THE END",
			endText: "The picture stops here.",
			intermission: "INTERMISSION",
			intermissionText: "The machine has stalled: capture it!",
			cut: "The screening is cut short.",
		},
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
			enlarge: "Enlarge this photo",
			viewer: (index: number, count: number) => `Photo ${index} of ${count}`,
			previous: "Previous",
			next: "Next",
			alt: (index: number) => `Photo ${index} of the game`,
			note: "Click a photo to enlarge and download it. They stay in your browser and are gone once the next game starts.",
		},
		backToLobby: "Back to lobby",
		home: "Home",
		duration: (minutes) => `${minutes}-minute hunt`,
		players: (count) => `${count} player${count === 1 ? "" : "s"}`,
		standings: "Standings",
		yourGame: "Your hunt",
		place: "Place",
		score: "Score",
		capturesLabel: "Captures",
		deathsLabel: "Falls",
		unlocksTitle: "Unlocked this game",
		challengeTag: "Challenge",
		rewardTag: "Reward",
	},
	loading: {
		kicker: "Opening the manor",
		waiting: "Waiting for the other players…",
		preparing: "Preparing…",
		back: "Back to home",
		tipLabel: "Tip",
		party: "Expedition",
		you: "you",
		tips: [
			"To capture an anomaly, hold its occult object and say its formula out loud.",
			"Flip through the grimoire with the wheel and the arrows: every species has its own plate and formula.",
			"You cannot cast from a hiding spot: step out before saying the formula.",
			"A fall costs you fragments. Another player can give you some to get you back on your feet.",
			"The Howler's scream drowns out your voice: wait for it to stop before casting.",
			"The Rat King scatters: wait for it to pull itself together before saying its formula.",
			"Whoever carries the bounty is easier for anomalies to sense, and rivals score by pushing them.",
			"The walkie-talkie carries your voice to the other players, even across the manor.",
			"Challenges progress in public games and the daily mode, never in private games.",
		],
		failed: (message: string) => `Loading failed: ${message}`,
		genericError: "Loading error",
		layoutUnavailable: "Manor map unavailable",
		layoutOtherMatch: "Map received for another game",
		layoutMismatch: "Inconsistent manor map",
		steps: {
			manor: "Generating the manor",
			collisions: "Collisions and map",
			textures: "Textures and 3D models",
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
