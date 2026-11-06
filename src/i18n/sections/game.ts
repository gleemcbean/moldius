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
			lantern: "Lanterne fermée",
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
			capture: (formula: string, lantern: string) => ({
				title: "Capturer",
				body: `Lanterne fermée (${lantern}), à moins de 5 m et l'objet occulte en main : prononcez à voix haute « ${formula} ». Inutile de viser.`,
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
			"lantern-open-required": "Il faut ouvrir la lanterne.",
			"lantern-closed-required": "Il faut fermer la lanterne.",
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
			lantern: "Lantern closed",
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
			capture: (formula: string, lantern: string) => ({
				title: "Capturing",
				body: `Lantern closed (${lantern}), within 5 m and with the occult object in hand: say "${formula}" out loud. No need to aim.`,
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
			"lantern-open-required": "You must open the lantern.",
			"lantern-closed-required": "You must close the lantern.",
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
