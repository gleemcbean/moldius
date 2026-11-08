import type { MaterialId, OccultId } from "@shared/config/occult";
import { SPECIES, SPECIES_IDS, type SpeciesId } from "@shared/config/species";

export interface SpeciesText {
	name: string;
	description: string;
	danger: string;
}

const SPECIES_FR = Object.fromEntries(
	SPECIES_IDS.map((id) => {
		const { name, description, danger } = SPECIES[id];
		return [id, { name, description, danger }];
	}),
) as Record<SpeciesId, SpeciesText>;

export const grimoireFr = {
	species: SPECIES_FR,
	points: (points: number) => `${points} points`,
	inPool: "Présente dans cette chasse",
	occultHeading: "Objet occulte",
	materials: {
		amethyst: "éclat d'améthyste",
		ruby: "éclat de rubis",
		jade: "éclat de jade",
		mirror: "bris de miroir",
		brass: "rouage de laiton",
		bone: "os gravé",
	} as Record<MaterialId, string>,
	objects: {
		pendulum: "Pendule d'améthyste",
		blackMirror: "Miroir noir",
		runeSkull: "Crâne runique",
		athame: "Athamé de rubis",
		jadeEye: "Œil de jade",
		censer: "Encensoir sacré",
	} as Record<OccultId, string>,
	craftAtAltar: "À fabriquer sur un autel, puis à garder sur soi.",
	incantation: "Incantation",
	aimToReveal: "Aucun exemplaire de cette espèce dans cette chasse.",
};

export const grimoireEn: typeof grimoireFr = {
	species: {
		murmure: {
			name: "The Whisper",
			description:
				"A hunched silhouette draped in pale rags. It drifts about whispering, quiet at rest, but light and noise make it unfold and charge.",
			danger:
				"Turns hostile to light or noise. Rears up before striking (22 damage).",
		},
		veilleur: {
			name: "The Gaslamp",
			description:
				"A tall soot-black body bent like an old street lamp, its head a lamp hood sweeping the rooms with a pale beam. As soon as it spots or hears someone, the light turns red and it lunges, swinging its long arms.",
			danger:
				"Chases by sight and sound, strikes on contact (34 damage). Its beam shows where it is looking.",
		},
		"crache-cendre": {
			name: "The Brazier",
			description:
				"A cast-iron bowl of embers carried on long jointed legs. It keeps its distance and lobs glowing embers in high arcs.",
			danger: "Visible ember projectiles (28 damage), keeps a firing distance.",
		},
		collecteur: {
			name: "The Collector",
			description:
				"A stooped, stilt-legged figure carrying a large sack. It opens doors, grabs its prey and carries it far away from its friends.",
			danger: "Grabs a player (12 damage), then drops them in another room.",
		},
		archiviste: {
			name: "The Archivist",
			description:
				"A heap of books and pages floating above a large runic circle. It transforms its room, pulls intruders in and shuts the doors behind them.",
			danger:
				"Pulls towards its circle (4.5 m). Telegraphed pulse every 3.4 s (32 damage inside the circle).",
		},
		luciole: {
			name: "The Will-o'-the-Wisp",
			description:
				"A living flame draped in veils of light. It floats peacefully and gently flees those who come too close.",
			danger: "Harmless. Gets scared if you crowd it.",
		},
		double: {
			name: "The Doppelgänger",
			description:
				"It mimics a mushroom of the team, its lantern, its gait and sometimes its voice. Even the map is fooled. When approached or lit up, it tears open to reveal a mouth full of teeth.",
			danger:
				"Reveals itself up close or in light, then chases and bites (36 damage). Opens doors.",
		},
		hurleur: {
			name: "The Howler",
			description:
				"A small, winged, shrieking thing, insanely fast. It latches onto another anomaly and circles it, screaming.",
			danger:
				"Its screams (7 m) prevent capturing other species. It does not attack.",
		},
		suinteur: {
			name: "The Oozer",
			description:
				"A greenish gelatinous mass that crawls and spits globs of slime. Its puddles stick to your feet for long seconds.",
			danger:
				"Spits slime (6 damage on impact): its puddles slow by 55% and eat 2 HP per second for 15 s. Jump over or go around.",
		},
		boursoufle: {
			name: "The Bloater",
			description:
				"A swollen sack of flesh that waddles towards groups. When two players approach it together, it swells up and bursts.",
			danger:
				"Explodes lethally if at least two players are within 5 m (1.2 s wind-up).",
		},
		colosse: {
			name: "The Colossus",
			description:
				"An iron-clad giant wrapped in chains. It charges anything it sees or hears, seizes its prey and hurls it through the nearest doorway into another room.",
			danger:
				"Grabs, then throws you into a neighbouring room (14 damage). Smashes closed doors open.",
		},
		fulgurant: {
			name: "The Fulgurant",
			description:
				"A brass automaton crowned with an ear trumpet, nearly blind. It turns towards the slightest noise, charges its ray cannon and fires where it heard you.",
			danger:
				"Fires a ray at the noise it heard (40 damage along the whole line), then overheats and stays still for 10 seconds.",
		},
		gorgone: {
			name: "The Weeper",
			description:
				"A stone statue that glides silently on its plinth, its face buried in its hands. A cold light seeps between its fingers. She ignores those who look away, but anyone who stares at her too long makes her lower her hands.",
			danger:
				"Staring at her for more than 3.5 s makes her unveil her glowing face, shriek and rush at you at full speed (45 damage). Look away and she forgets you.",
		},
		brume: {
			name: "The Haze",
			description:
				"A patch of fog that has taken shape, with two cold glints for a gaze. It latches onto the first player it sees and follows them everywhere, slipping behind their back and drowning their sight in thick fog.",
			danger:
				"Harmless, but the player it follows can barely see anything around them, except the Haze itself. It freezes when looked at and eventually loses interest, but no sprint shakes it off: it follows your trail step by step.",
		},
		"rat-roi": {
			name: "The Rat King",
			description:
				"A teeming ball of big black rats whose tails are tied into a single knot, glowing faintly at its heart. It rolls through the dark, hears everything and looks in every direction at once.",
			danger:
				"Bites on contact (20 damage). Lantern light scatters it into a swarm of rats that bite anyone walking through, then it knots back together a few seconds after darkness returns.",
		},
	},
	points: (points: number) => `${points} points`,
	inPool: "Present in this hunt",
	occultHeading: "Occult object",
	materials: {
		amethyst: "amethyst shard",
		ruby: "ruby shard",
		jade: "jade shard",
		mirror: "mirror fragment",
		brass: "brass cog",
		bone: "carved bone",
	},
	objects: {
		pendulum: "Amethyst Pendulum",
		blackMirror: "Black Mirror",
		runeSkull: "Runic Skull",
		athame: "Ruby Athame",
		jadeEye: "Jade Eye",
		censer: "Sacred Censer",
	},
	craftAtAltar: "Craft it on an altar, then keep it on you.",
	incantation: "Incantation",
	aimToReveal: "No specimen of this species in this hunt.",
};
