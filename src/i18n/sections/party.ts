import type {
	EmoteId,
	ManorEventKind,
	MutatorId,
	PingKind,
} from "@shared/config/party";
import type {
	StatsCorner,
	StatsMetric,
	StatsPreset,
} from "../../types/settings";

export const partyFr = {
	ghost: {
		title: "Vous êtes un fantôme",
		respawn: (seconds: number) => `Retour parmi les vivants dans ${seconds} s`,
		oneLife: "Une seule vie : vous hantez le manoir jusqu'à la fin",
		hint: (rise: string, sink: string, fast: string) =>
			`${rise} pour monter, ${sink} pour descendre, ${fast} pour filer. Les vivants ne vous voient pas et n'entendent que vos coups.`,
		voice: "Seuls les autres fantômes entendent votre voix",
		door: "Claquer la porte",
		knock: "Frapper",
		slam: "Claquer",
		bounds: "Le manoir vous retient : impossible d'aller plus loin",
		haunting: (name: string) => `${name} hante le manoir`,
	},
	ping: {
		kinds: {
			here: "Ici",
			danger: "Danger",
			monster: "Anomalie",
			altar: "Autel",
			material: "Matériau",
			hide: "Cachette",
			regroup: "Regroupement",
		} satisfies Record<PingKind, string>,
		wheel: "Signaler",
		label: "Signaler",
		hint: (key: string) =>
			`${key} : signaler ce que vous visez · maintenu : choisir le signal`,
		by: (name: string, kind: string) => `${name} : ${kind}`,
		distance: (meters: number) => `${meters} m`,
		solo: "Sans allié dans cette partie, vos signaux ne sont visibles que par vous",
		wait: "Trop de signaux : patientez un instant",
	},
	emote: {
		names: {
			wave: "Salut",
			dance: "Danse",
			bow: "Révérence",
			point: "Par là !",
			laugh: "Rire",
			panic: "Panique",
		} satisfies Record<EmoteId, string>,
		wheel: "Émotes",
		label: "Émotes",
	},
	wheel: {
		hint: "Bougez la souris vers un choix, relâchez pour valider",
	},
	gift: {
		prompt: (name: string) => `Donner un fragment à ${name}`,
		title: (name: string) => `Donner à ${name}`,
		hint: "Molette ou chiffre : choisir un matériau · Interagir : donner 1 · Échap : fermer",
		given: (material: string, name: string) =>
			`Vous donnez 1 ${material} à ${name}`,
		received: (material: string, name: string) =>
			`${name} vous donne 1 ${material}`,
		none: "Vous n'avez aucun fragment à donner",
		owned: (count: number) => `×${count}`,
	},
	events: {
		names: {
			bloodMoon: "Lune rouge",
			lockdown: "Verrouillage",
			fragmentRain: "Pluie de fragments",
			thickFog: "Brume épaisse",
			frenzy: "Frénésie",
			greenTide: "Marée verte",
		} satisfies Record<ManorEventKind, string>,
		descriptions: {
			bloodMoon: "Les captures rapportent le double de points",
			lockdown: "Les portes claquent et restent verrouillées",
			fragmentRain: "Tous les matériaux pris réapparaissent",
			thickFog: "On n'y voit plus rien, les anomalies non plus",
			frenzy: "Les anomalies se déplacent bien plus vite",
			greenTide: "Toutes les vannes d'eau verte s'ouvrent",
		} satisfies Record<ManorEventKind, string>,
		warning: (name: string, seconds: number) => `${name} dans ${seconds} s`,
		active: (name: string, seconds: number) => `${name} · ${seconds} s`,
		started: (name: string, description: string) => `${name} : ${description}`,
		ended: (name: string) => `${name} : terminé`,
		locked: "Porte verrouillée",
	},
	bounty: {
		tag: "Prime",
		you: (value: number) =>
			`Vous portez la prime (${value} pts) : les monstres vous sentent mieux et vos rivaux ont intérêt à vous pousser`,
		other: (name: string, value: number) =>
			`${name} porte la prime : ${value} pts pour qui le pousse avant sa chute`,
		gone: "Plus personne ne porte la prime",
		pushReward: (points: number, name: string) =>
			`+${points} pts : vous bousculez ${name}, le leader`,
		claimed: (name: string, points: number, target: string) =>
			`${name} encaisse la prime de ${target} : +${points} pts`,
		hud: (name: string, value: number) => `Prime : ${name} · ${value} pts`,
		hudSelf: (value: number) => `Vous portez la prime · ${value} pts`,
	},
	mutators: {
		names: {
			oneLife: "Une seule vie",
			noMap: "Sans carte",
			darkness: "Lanternes interdites",
			strongPush: "Poussée surpuissante",
			chaosBrews: "Potions folles",
			megaphone: "Mégaphone",
			infiniteEnergy: "Énergie infinie",
		} satisfies Record<MutatorId, string>,
		hints: {
			oneLife:
				"Les morts restent fantômes jusqu'à la fin. La partie s'arrête si tout le monde tombe.",
			noMap: "Ni minicarte ni grande carte : il faut retenir le chemin.",
			darkness: "Impossible d'ouvrir sa lanterne de toute la partie.",
			strongPush:
				"Les poussées envoient bien plus loin, coûtent moitié moins et se rechargent deux fois plus vite.",
			chaosBrews:
				"Toutes les 45 secondes, chaque joueur reçoit un effet de potion au hasard.",
			megaphone: "Tout le monde s'entend partout dans le manoir, sans portée.",
			infiniteEnergy: "Course, sauts et lanterne sans limite d'énergie.",
		} satisfies Record<MutatorId, string>,
		noMap: "Sans carte : pas de plan pour cette partie",
		darkness: "Lanternes interdites : la vôtre reste fermée",
	},
	rules: {
		group: "Pour pimenter",
		events: "Événements du manoir",
		eventsHint:
			"Lune rouge, verrouillage, brume épaisse… un événement surprise toutes les deux à trois minutes.",
		bounty: "Prime sur le leader",
		bountyHint:
			"Le joueur largement en tête porte une prime : les monstres le sentent mieux et le pousser rapporte des points. Seulement en chacun pour soi.",
		mutators: "Mutateurs",
		mutatorCount: (count: number) => (count === 0 ? "Aucun" : String(count)),
		possessedNote:
			"Mode Le Possédé : chacun pour soi imposé, prime désactivée, un rituel commun à accomplir.",
		mode: "Mode",
	},
	possessed: {
		modeName: "Le Possédé",
		modeText:
			"Mode spécial. Un joueur est secrètement possédé : les anomalies l'ignorent et il sabote le rituel. Les autres capturent ensemble, puis votent pour le démasquer.",
		modeMeta: (min: number) => `Partie publique, au moins ${min} joueurs`,
		privateGame: "Partie privée entre amis",
		roleHunter: "Vous êtes Chasseur",
		roleHunterText: (quota: number) =>
			`Capturez ${quota} anomalies à plusieurs pour accomplir le rituel, puis démasquez le possédé au vote. Méfiez-vous de celui que les monstres épargnent.`,
		rolePossessed: "Vous êtes le Possédé",
		rolePossessedText: (key: string) =>
			`Les anomalies vous ignorent et apparaissent sur votre carte. Empêchez le rituel sans vous faire démasquer. ${key} : maléfice (près d'un autel, il le profane ; sinon il attire les monstres là où vous regardez).`,
		ritual: (captures: number, quota: number) => `Rituel ${captures}/${quota}`,
		power: "Maléfice",
		curseDone: "Autel profané pour 50 s",
		callDone: "Les ténèbres appellent les anomalies",
		powerFailed: "Le maléfice ne trouve pas sa cible",
		altarCursed: "Autel profané : il refuse de servir pour l'instant",
		darkCall: "Un appel lugubre résonne dans le manoir…",
		quotaReached: "Le rituel est prêt : démasquez le possédé !",
		voteTitle: "Qui est le possédé ?",
		voteText:
			"Discutez à voix haute, puis votez. En cas d'égalité ou d'erreur, le possédé l'emporte.",
		voteRemaining: (seconds: number) => `${seconds} s`,
		voteCast: "Vote enregistré : vous pouvez encore changer d'avis",
		voted: (count: number, total: number) => `${count}/${total} ont voté`,
		hasVoted: "a voté",
		you: "Vous",
		results: {
			huntersWin: "Les chasseurs l'emportent",
			possessedWin: "Le possédé l'emporte",
			was: (name: string) => `Le possédé était ${name}`,
			unmasked: "Démasqué au vote",
			notUnmasked: "Il a échappé au vote",
			ritualFailed: (captures: number, quota: number) =>
				`Rituel inachevé : ${captures}/${quota} captures`,
			ritualDone: (captures: number, quota: number) =>
				`Rituel accompli : ${captures}/${quota} captures`,
			votes: "Votes",
			noVote: "pas de vote",
		},
		lobbyBadge: "Mode spécial : Le Possédé",
	},
	stats: {
		tab: "Statistiques",
		section: "Statistiques à l'écran",
		sectionHint:
			"Un petit panneau en jeu pour surveiller les performances et la connexion.",
		preset: "Préréglage",
		presets: {
			off: "Aucune",
			minimal: "Minimal",
			network: "Réseau",
			full: "Tout",
		} satisfies Record<StatsPreset, string>,
		custom: "Personnalisé",
		metrics: {
			fps: "Images par seconde",
			frameTime: "Temps d'image",
			ping: "Ping (aller-retour)",
			jitter: "Gigue réseau",
			snapshots: "Instantanés reçus par seconde",
			loss: "Instantanés perdus",
			interpolation: "Délai d'interpolation",
			drawCalls: "Appels de dessin",
			triangles: "Triangles affichés",
			memory: "Mémoire JavaScript",
			voice: "Liaisons vocales",
		} satisfies Record<StatsMetric, string>,
		hints: {
			fps: "Nombre d'images affichées chaque seconde.",
			frameTime: "Durée moyenne et pire durée d'une image récente.",
			ping: "Temps d'aller-retour entre votre machine et le serveur.",
			jitter: "Variation du ping : plus elle est forte, plus le jeu saccade.",
			snapshots: "États du monde reçus du serveur chaque seconde.",
			loss: "Part des états du monde jamais reçus sur les dernières secondes.",
			interpolation:
				"Retard volontaire appliqué aux autres joueurs pour les lisser.",
			drawCalls: "Nombre d'ordres de dessin envoyés à la carte graphique.",
			triangles: "Géométrie dessinée à chaque image.",
			memory: "Mémoire utilisée par la page (Chrome et Edge seulement).",
			voice:
				"Liaisons de tchat vocal actives, et celles passant par le relais.",
		} satisfies Record<StatsMetric, string>,
		short: {
			fps: "FPS",
			frameTime: "Image",
			ping: "Ping",
			jitter: "Gigue",
			snapshots: "Instant.",
			loss: "Pertes",
			interpolation: "Interp.",
			drawCalls: "Dessins",
			triangles: "Triangles",
			memory: "Mémoire",
			voice: "Voix",
		} satisfies Record<StatsMetric, string>,
		corner: "Position",
		corners: {
			topLeft: "Haut gauche",
			topRight: "Haut droite",
			bottomLeft: "Bas gauche",
			bottomRight: "Bas droite",
		} satisfies Record<StatsCorner, string>,
		graph: "Graphe des temps d'image",
		opacity: "Opacité du panneau",
		unavailable: "n/d",
		milliseconds: (value: number) => `${value} ms`,
		frameTime: (average: number, worst: number) =>
			`${average.toFixed(1)} / ${worst.toFixed(0)} ms`,
		perSecond: (value: number) => `${value}/s`,
		percent: (value: number) => `${value} %`,
		megabytes: (value: number) => `${value} Mo`,
		thousands: (value: number) =>
			value >= 1000 ? `${(value / 1000).toFixed(1)} k` : String(value),
		voice: (connected: number, total: number, relayed: number) =>
			relayed > 0
				? `${connected}/${total} (${relayed} relais)`
				: `${connected}/${total}`,
	},
};

export const partyEn: typeof partyFr = {
	ghost: {
		title: "You are a ghost",
		respawn: (seconds: number) => `Back among the living in ${seconds} s`,
		oneLife: "One life: you haunt the manor until the end",
		hint: (rise: string, sink: string, fast: string) =>
			`${rise} to rise, ${sink} to sink, ${fast} to glide faster. The living cannot see you and only hear your knocks.`,
		voice: "Only other ghosts can hear your voice",
		door: "Slam the door",
		knock: "Knock",
		slam: "Slam",
		bounds: "The manor holds you back: you cannot go further",
		haunting: (name: string) => `${name} haunts the manor`,
	},
	ping: {
		kinds: {
			here: "Here",
			danger: "Danger",
			monster: "Anomaly",
			altar: "Altar",
			material: "Material",
			hide: "Hiding spot",
			regroup: "Regroup",
		},
		wheel: "Ping",
		label: "Ping",
		hint: (key: string) =>
			`${key}: ping what you aim at · hold: choose the ping`,
		by: (name: string, kind: string) => `${name}: ${kind}`,
		distance: (meters: number) => `${meters} m`,
		solo: "No allies in this game: only you can see your pings",
		wait: "Too many pings: wait a moment",
	},
	emote: {
		names: {
			wave: "Wave",
			dance: "Dance",
			bow: "Bow",
			point: "Over there!",
			laugh: "Laugh",
			panic: "Panic",
		},
		wheel: "Emotes",
		label: "Emotes",
	},
	wheel: {
		hint: "Move the mouse towards a choice, release to confirm",
	},
	gift: {
		prompt: (name: string) => `Give a fragment to ${name}`,
		title: (name: string) => `Give to ${name}`,
		hint: "Wheel or number: pick a material · Interact: give 1 · Esc: close",
		given: (material: string, name: string) =>
			`You give 1 ${material} to ${name}`,
		received: (material: string, name: string) =>
			`${name} gives you 1 ${material}`,
		none: "You have no fragment to give",
		owned: (count: number) => `×${count}`,
	},
	events: {
		names: {
			bloodMoon: "Blood moon",
			lockdown: "Lockdown",
			fragmentRain: "Fragment shower",
			thickFog: "Thick fog",
			frenzy: "Frenzy",
			greenTide: "Green tide",
		},
		descriptions: {
			bloodMoon: "Captures are worth double points",
			lockdown: "Doors slam shut and stay locked",
			fragmentRain: "Every taken material comes back",
			thickFog: "Nobody can see a thing, anomalies included",
			frenzy: "Anomalies move much faster",
			greenTide: "Every green water valve opens",
		},
		warning: (name: string, seconds: number) => `${name} in ${seconds} s`,
		active: (name: string, seconds: number) => `${name} · ${seconds} s`,
		started: (name: string, description: string) => `${name}: ${description}`,
		ended: (name: string) => `${name}: over`,
		locked: "Door locked",
	},
	bounty: {
		tag: "Bounty",
		you: (value: number) =>
			`You carry the bounty (${value} pts): monsters sense you better and rivals want to push you`,
		other: (name: string, value: number) =>
			`${name} carries the bounty: ${value} pts for whoever pushes them to their doom`,
		gone: "Nobody carries the bounty any more",
		pushReward: (points: number, name: string) =>
			`+${points} pts: you shove ${name}, the leader`,
		claimed: (name: string, points: number, target: string) =>
			`${name} claims ${target}'s bounty: +${points} pts`,
		hud: (name: string, value: number) => `Bounty: ${name} · ${value} pts`,
		hudSelf: (value: number) => `You carry the bounty · ${value} pts`,
	},
	mutators: {
		names: {
			oneLife: "One life",
			noMap: "No map",
			darkness: "No lanterns",
			strongPush: "Mighty push",
			chaosBrews: "Crazy brews",
			megaphone: "Megaphone",
			infiniteEnergy: "Infinite energy",
		},
		hints: {
			oneLife:
				"The dead stay ghosts until the end. The game stops if everybody falls.",
			noMap: "No minimap and no big map: remember the way.",
			darkness: "Lanterns cannot be opened for the whole game.",
			strongPush:
				"Pushes send players much further, cost half as much and recharge twice as fast.",
			chaosBrews: "Every 45 seconds, each player gets a random brew effect.",
			megaphone: "Everyone hears everyone anywhere in the manor, no range.",
			infiniteEnergy: "Running, jumping and lanterns with no energy limit.",
		},
		noMap: "No map: there is no plan for this game",
		darkness: "No lanterns: yours stays closed",
	},
	rules: {
		group: "Spice it up",
		events: "Manor events",
		eventsHint:
			"Blood moon, lockdown, thick fog… a surprise event every two to three minutes.",
		bounty: "Bounty on the leader",
		bountyHint:
			"A player far ahead carries a bounty: monsters sense them better and pushing them earns points. Free-for-all only.",
		mutators: "Mutators",
		mutatorCount: (count: number) => (count === 0 ? "None" : String(count)),
		possessedNote:
			"The Possessed mode: free-for-all enforced, bounty off, a shared ritual to complete.",
		mode: "Mode",
	},
	possessed: {
		modeName: "The Possessed",
		modeText:
			"A special mode. One player is secretly possessed: anomalies ignore them and they sabotage the ritual. The others capture together, then vote to unmask them.",
		modeMeta: (min: number) => `Public game, at least ${min} players`,
		privateGame: "Private game with friends",
		roleHunter: "You are a Hunter",
		roleHunterText: (quota: number) =>
			`Capture ${quota} anomalies together to complete the ritual, then unmask the possessed in the vote. Beware of whoever the monsters spare.`,
		rolePossessed: "You are the Possessed",
		rolePossessedText: (key: string) =>
			`Anomalies ignore you and show on your map. Stop the ritual without being unmasked. ${key}: hex (near an altar it defiles it, otherwise it lures monsters where you look).`,
		ritual: (captures: number, quota: number) => `Ritual ${captures}/${quota}`,
		power: "Hex",
		curseDone: "Altar defiled for 50 s",
		callDone: "The darkness calls the anomalies",
		powerFailed: "The hex finds no target",
		altarCursed: "Defiled altar: it refuses to serve for now",
		darkCall: "A dismal call echoes through the manor…",
		quotaReached: "The ritual is ready: unmask the possessed!",
		voteTitle: "Who is the possessed?",
		voteText:
			"Talk it out loud, then vote. On a tie or a wrong guess, the possessed wins.",
		voteRemaining: (seconds: number) => `${seconds} s`,
		voteCast: "Vote recorded: you can still change your mind",
		voted: (count: number, total: number) => `${count}/${total} voted`,
		hasVoted: "voted",
		you: "You",
		results: {
			huntersWin: "The hunters win",
			possessedWin: "The possessed wins",
			was: (name: string) => `The possessed was ${name}`,
			unmasked: "Unmasked by the vote",
			notUnmasked: "Escaped the vote",
			ritualFailed: (captures: number, quota: number) =>
				`Ritual unfinished: ${captures}/${quota} captures`,
			ritualDone: (captures: number, quota: number) =>
				`Ritual complete: ${captures}/${quota} captures`,
			votes: "Votes",
			noVote: "no vote",
		},
		lobbyBadge: "Special mode: The Possessed",
	},
	stats: {
		tab: "Statistics",
		section: "On-screen statistics",
		sectionHint:
			"A small in-game panel to keep an eye on performance and connection.",
		preset: "Preset",
		presets: {
			off: "None",
			minimal: "Minimal",
			network: "Network",
			full: "Everything",
		},
		custom: "Custom",
		metrics: {
			fps: "Frames per second",
			frameTime: "Frame time",
			ping: "Ping (round trip)",
			jitter: "Network jitter",
			snapshots: "Snapshots received per second",
			loss: "Lost snapshots",
			interpolation: "Interpolation delay",
			drawCalls: "Draw calls",
			triangles: "Triangles drawn",
			memory: "JavaScript memory",
			voice: "Voice links",
		},
		hints: {
			fps: "Number of frames shown each second.",
			frameTime: "Average and worst duration of a recent frame.",
			ping: "Round trip time between your machine and the server.",
			jitter: "Ping variation: the higher it is, the more the game stutters.",
			snapshots: "World states received from the server each second.",
			loss: "Share of world states never received over the last seconds.",
			interpolation:
				"Deliberate delay applied to other players to smooth them.",
			drawCalls: "Number of draw orders sent to the graphics card.",
			triangles: "Geometry drawn each frame.",
			memory: "Memory used by the page (Chrome and Edge only).",
			voice: "Active voice chat links, and those going through the relay.",
		},
		short: {
			fps: "FPS",
			frameTime: "Frame",
			ping: "Ping",
			jitter: "Jitter",
			snapshots: "Snaps",
			loss: "Loss",
			interpolation: "Interp.",
			drawCalls: "Draws",
			triangles: "Triangles",
			memory: "Memory",
			voice: "Voice",
		},
		corner: "Position",
		corners: {
			topLeft: "Top left",
			topRight: "Top right",
			bottomLeft: "Bottom left",
			bottomRight: "Bottom right",
		},
		graph: "Frame time graph",
		opacity: "Panel opacity",
		unavailable: "n/a",
		milliseconds: (value: number) => `${value} ms`,
		frameTime: (average: number, worst: number) =>
			`${average.toFixed(1)} / ${worst.toFixed(0)} ms`,
		perSecond: (value: number) => `${value}/s`,
		percent: (value: number) => `${value}%`,
		megabytes: (value: number) => `${value} MB`,
		thousands: (value: number) =>
			value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value),
		voice: (connected: number, total: number, relayed: number) =>
			relayed > 0
				? `${connected}/${total} (${relayed} relayed)`
				: `${connected}/${total}`,
	},
};
