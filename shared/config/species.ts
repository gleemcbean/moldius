export const SPECIES_IDS = [
	"murmure",
	"veilleur",
	"crache-cendre",
	"collecteur",
	"archiviste",
	"luciole",
	"double",
	"hurleur",
	"suinteur",
	"boursoufle",
	"colosse",
	"fulgurant",
	"gorgone",
	"brume",
	"rat-roi",
] as const;

export type SpeciesId = (typeof SPECIES_IDS)[number];

export type LanternRequirement = "open" | "closed" | "any";

export interface CaptureRules {
	maxRange: number;
	lantern: LanternRequirement;
}

export type AttackKind =
	| "melee"
	| "ember"
	| "grab"
	| "pulse"
	| "slime"
	| "explode"
	| "throw"
	| "laser"
	| "none";

export type SpeciesTier = 1 | 2 | 3;

export interface SpeciesDefinition {
	id: SpeciesId;
	page: number;
	tier: SpeciesTier;
	name: string;
	points: number;
	description: string;
	danger: string;
	hostile: boolean;
	calmSpeed: number;
	hostileSpeed: number;
	damage: number;
	attack: AttackKind;
	attackRange: number;
	windupMs: number;
	recoveryMs: number;
	viewRange: number;
	fieldOfView: number;
	hearing: number;
	canOpenDoors: boolean;
	flying: boolean;
	bodyHeight: number;
	aimRadius: number;
	capture: CaptureRules;
}

function capture(rules: Partial<CaptureRules>): CaptureRules {
	return { maxRange: 5, lantern: "any", ...rules };
}

export const SPECIES: Record<SpeciesId, SpeciesDefinition> = {
	murmure: {
		id: "murmure",
		page: 1,
		tier: 2,
		name: "Le Murmure",
		points: 100,
		description:
			"Silhouette voûtée drapée de lambeaux pâles. Il dérive en chuchotant, discret au repos, mais la lumière et le bruit le font se déployer et charger.",
		danger:
			"Devient hostile à la lumière ou au bruit. Se dresse avant de frapper (22 dégâts).",
		hostile: true,
		calmSpeed: 1.8,
		hostileSpeed: 4.2,
		damage: 22,
		attack: "melee",
		attackRange: 1.6,
		windupMs: 700,
		recoveryMs: 1150,
		viewRange: 11,
		fieldOfView: (150 * Math.PI) / 180,
		hearing: 1.15,
		canOpenDoors: false,
		flying: false,
		bodyHeight: 2.05,
		aimRadius: 0.5,
		capture: capture({ lantern: "closed", maxRange: 5 }),
	},
	veilleur: {
		id: "veilleur",
		page: 2,
		tier: 3,
		name: "Le Réverbère",
		points: 300,
		description:
			"Grand corps noir de suie, courbé comme un vieux réverbère, dont la tête est un abat-jour qui balaie les pièces d'un faisceau pâle. Dès qu'il voit ou entend quelqu'un, la lumière vire au rouge et il fond sur lui en balançant ses longs bras.",
		danger:
			"Poursuite à vue et au son, frappe au contact (34 dégâts). Son faisceau montre où il regarde.",
		hostile: true,
		calmSpeed: 2.2,
		hostileSpeed: 4.65,
		damage: 34,
		attack: "melee",
		attackRange: 1.75,
		windupMs: 850,
		recoveryMs: 1150,
		viewRange: 16,
		fieldOfView: (120 * Math.PI) / 180,
		hearing: 1.0,
		canOpenDoors: false,
		flying: false,
		bodyHeight: 2.3,
		aimRadius: 0.55,
		capture: capture({ lantern: "open", maxRange: 3.8 }),
	},
	"crache-cendre": {
		id: "crache-cendre",
		page: 3,
		tier: 2,
		name: "Le Brasier",
		points: 450,
		description:
			"Vasque de fonte pleine de braises, portée par de longues pattes articulées. Il garde ses distances et projette des braises incandescentes en cloche.",
		danger:
			"Projectiles de braises visibles (28 dégâts), garde une distance de tir.",
		hostile: true,
		calmSpeed: 2.0,
		hostileSpeed: 4.25,
		damage: 28,
		attack: "ember",
		attackRange: 10,
		windupMs: 900,
		recoveryMs: 2600,
		viewRange: 15,
		fieldOfView: (130 * Math.PI) / 180,
		hearing: 0.9,
		canOpenDoors: false,
		flying: false,
		bodyHeight: 1.7,
		aimRadius: 0.6,
		capture: capture({ maxRange: 5 }),
	},
	collecteur: {
		id: "collecteur",
		page: 4,
		tier: 2,
		name: "Le Collecteur",
		points: 650,
		description:
			"Échassier voûté portant un grand sac. Il ouvre les portes, empoigne sa proie et l'emporte loin de ses amis.",
		danger: "Saisit un joueur (12 dégâts) puis le dépose dans une autre salle.",
		hostile: true,
		calmSpeed: 2.3,
		hostileSpeed: 4.85,
		damage: 12,
		attack: "grab",
		attackRange: 1.7,
		windupMs: 1000,
		recoveryMs: 1500,
		viewRange: 15,
		fieldOfView: (120 * Math.PI) / 180,
		hearing: 1.0,
		canOpenDoors: true,
		flying: false,
		bodyHeight: 2.5,
		aimRadius: 0.6,
		capture: capture({ lantern: "closed", maxRange: 5 }),
	},
	archiviste: {
		id: "archiviste",
		page: 5,
		tier: 2,
		name: "L'Archiviste",
		points: 550,
		description:
			"Amas de livres et de pages flottant au-dessus d'un grand cercle runique. Il transforme sa salle, attire les intrus et referme les portes derrière eux.",
		danger:
			"Attire vers son cercle (4,5 m). Pulsation télégraphiée toutes les 3,4 s (32 dégâts dans le cercle).",
		hostile: true,
		calmSpeed: 0,
		hostileSpeed: 0,
		damage: 32,
		attack: "pulse",
		attackRange: 4.5,
		windupMs: 1100,
		recoveryMs: 2300,
		viewRange: 12,
		fieldOfView: Math.PI * 2,
		hearing: 0.5,
		canOpenDoors: false,
		flying: true,
		bodyHeight: 2.6,
		aimRadius: 0.85,
		capture: capture({ lantern: "open", maxRange: 6.5 }),
	},
	luciole: {
		id: "luciole",
		page: 6,
		tier: 1,
		name: "Le Feu follet",
		points: 150,
		description:
			"Flamme vivante drapée de voiles de lumière. Il flotte paisiblement et fuit doucement ceux qui l'approchent trop.",
		danger: "Inoffensif. S'effraie si on le serre de trop près.",
		hostile: false,
		calmSpeed: 0.9,
		hostileSpeed: 1.6,
		damage: 0,
		attack: "none",
		attackRange: 0,
		windupMs: 0,
		recoveryMs: 0,
		viewRange: 6,
		fieldOfView: Math.PI * 2,
		hearing: 0.6,
		canOpenDoors: false,
		flying: true,
		bodyHeight: 1.6,
		aimRadius: 0.4,
		capture: capture({ lantern: "closed", maxRange: 2.8 }),
	},
	double: {
		id: "double",
		page: 7,
		tier: 3,
		name: "Le Doppelgänger",
		points: 500,
		description:
			"Il imite un champignon de l'équipe, sa lanterne et sa démarche. Approché ou éclairé, il se déchire et révèle une gueule pleine de dents.",
		danger:
			"Se révèle de près ou à la lumière, puis poursuit et mord (36 dégâts). Ouvre les portes.",
		hostile: true,
		calmSpeed: 3.6,
		hostileSpeed: 4.9,
		damage: 36,
		attack: "melee",
		attackRange: 1.6,
		windupMs: 750,
		recoveryMs: 1150,
		viewRange: 14,
		fieldOfView: (140 * Math.PI) / 180,
		hearing: 1.0,
		canOpenDoors: true,
		flying: false,
		bodyHeight: 1.75,
		aimRadius: 0.5,
		capture: capture({ maxRange: 5 }),
	},
	hurleur: {
		id: "hurleur",
		page: 8,
		tier: 1,
		name: "Le Hurleur",
		points: 80,
		description:
			"Petite chose ailée et hurlante, d'une vitesse folle. Elle s'attache à une autre anomalie et tourne autour d'elle en hurlant.",
		danger:
			"Ses cris (7 m) empêchent de capturer les autres espèces. Il n'attaque pas.",
		hostile: false,
		calmSpeed: 4,
		hostileSpeed: 8.8,
		damage: 0,
		attack: "none",
		attackRange: 0,
		windupMs: 0,
		recoveryMs: 0,
		viewRange: 10,
		fieldOfView: Math.PI * 2,
		hearing: 0.4,
		canOpenDoors: false,
		flying: true,
		bodyHeight: 1.7,
		aimRadius: 0.55,
		capture: capture({ maxRange: 5 }),
	},
	suinteur: {
		id: "suinteur",
		page: 9,
		tier: 2,
		name: "Le Suinteur",
		points: 350,
		description:
			"Masse gélatineuse verdâtre qui rampe et crache des paquets de slime. Ses flaques collent aux pieds pendant de longues secondes.",
		danger:
			"Crache du slime (6 dégâts à l'impact) : ses flaques ralentissent de 55 % et rongent 2 PV par seconde pendant 15 s. Sautez par-dessus ou contournez.",
		hostile: true,
		calmSpeed: 1.8,
		hostileSpeed: 4.1,
		damage: 6,
		attack: "slime",
		attackRange: 9,
		windupMs: 1100,
		recoveryMs: 4500,
		viewRange: 14,
		fieldOfView: (140 * Math.PI) / 180,
		hearing: 0.9,
		canOpenDoors: false,
		flying: false,
		bodyHeight: 1.3,
		aimRadius: 0.65,
		capture: capture({ lantern: "open", maxRange: 5 }),
	},
	boursoufle: {
		id: "boursoufle",
		page: 10,
		tier: 2,
		name: "Le Boursouflé",
		points: 600,
		description:
			"Sac de chair gonflé qui se dandine vers les groupes. Quand deux joueurs s'en approchent ensemble, il enfle puis éclate.",
		danger:
			"Explose de façon mortelle si au moins deux joueurs sont à moins de 5 m (1,2 s de préparation).",
		hostile: true,
		calmSpeed: 1.6,
		hostileSpeed: 3.6,
		damage: 999,
		attack: "explode",
		attackRange: 5,
		windupMs: 1200,
		recoveryMs: 0,
		viewRange: 12,
		fieldOfView: (160 * Math.PI) / 180,
		hearing: 0.8,
		canOpenDoors: false,
		flying: false,
		bodyHeight: 1.4,
		aimRadius: 0.8,
		capture: capture({ lantern: "closed", maxRange: 5 }),
	},
	colosse: {
		id: "colosse",
		page: 11,
		tier: 3,
		name: "Le Colosse",
		points: 400,
		description:
			"Géant cuirassé de fer et de chaînes. Il charge tout ce qu'il voit ou entend, empoigne sa proie et la projette à travers la porte la plus proche, dans une autre pièce.",
		danger:
			"Saisit puis projette dans une pièce voisine (14 dégâts). Fracasse les portes fermées sur son passage.",
		hostile: true,
		calmSpeed: 1.7,
		hostileSpeed: 3.9,
		damage: 14,
		attack: "throw",
		attackRange: 1.9,
		windupMs: 900,
		recoveryMs: 2400,
		viewRange: 13,
		fieldOfView: (110 * Math.PI) / 180,
		hearing: 0.9,
		canOpenDoors: true,
		flying: false,
		bodyHeight: 2.35,
		aimRadius: 0.7,
		capture: capture({ maxRange: 5 }),
	},
	fulgurant: {
		id: "fulgurant",
		page: 12,
		tier: 3,
		name: "Le Fulgurant",
		points: 350,
		description:
			"Automate d'airain coiffé d'un cornet acoustique, presque aveugle. Il se tourne vers le moindre bruit, charge son canon à rayon et tire là où il vous a entendu.",
		danger:
			"Tire un rayon vers le bruit entendu (40 dégâts sur toute la ligne de tir), puis surchauffe et reste immobile 10 secondes.",
		hostile: true,
		calmSpeed: 1.4,
		hostileSpeed: 2.4,
		damage: 40,
		attack: "laser",
		attackRange: 18,
		windupMs: 1500,
		recoveryMs: 10_000,
		viewRange: 4.5,
		fieldOfView: (70 * Math.PI) / 180,
		hearing: 1.8,
		canOpenDoors: false,
		flying: false,
		bodyHeight: 1.85,
		aimRadius: 0.5,
		capture: capture({ maxRange: 6 }),
	},
	gorgone: {
		id: "gorgone",
		page: 13,
		tier: 3,
		name: "La Pleureuse",
		points: 450,
		description:
			"Statue de pierre qui glisse sans un bruit sur son socle, le visage enfoui dans ses mains. Une lumière froide filtre entre ses doigts. Elle ignore ceux qui détournent les yeux, mais quiconque la fixe trop longtemps lui fait baisser les mains.",
		danger:
			"La fixer plus de 3,5 s lui fait dévoiler son visage lumineux et hurler, puis elle fond sur vous à toute vitesse (45 dégâts). Détournez le regard pour qu'elle vous oublie.",
		hostile: true,
		calmSpeed: 1.5,
		hostileSpeed: 9.2,
		damage: 45,
		attack: "melee",
		attackRange: 1.7,
		windupMs: 300,
		recoveryMs: 1600,
		viewRange: 0,
		fieldOfView: 0,
		hearing: 0,
		canOpenDoors: true,
		flying: false,
		bodyHeight: 2.0,
		aimRadius: 0.5,
		capture: capture({ maxRange: 5 }),
	},
	brume: {
		id: "brume",
		page: 14,
		tier: 1,
		name: "La Brume",
		points: 200,
		description:
			"Nappe de brouillard qui a pris forme, avec deux lueurs froides en guise de regard. Elle s'attache au premier joueur qu'elle aperçoit et le suit partout en se glissant dans son dos, noyant sa vue dans un brouillard épais.",
		danger:
			"Inoffensive, mais le joueur qu'elle suit ne voit presque plus rien autour de lui, sauf elle. Elle se fige quand on la regarde et se lasse au bout d'un moment, mais aucun sprint ne la distance : elle suit votre trace pas à pas.",
		hostile: false,
		calmSpeed: 1.3,
		hostileSpeed: 5.4,
		damage: 0,
		attack: "none",
		attackRange: 0,
		windupMs: 0,
		recoveryMs: 0,
		viewRange: 12,
		fieldOfView: Math.PI * 2,
		hearing: 0.5,
		canOpenDoors: false,
		flying: true,
		bodyHeight: 1,
		aimRadius: 0.4,
		capture: capture({ lantern: "open", maxRange: 4 }),
	},
	"rat-roi": {
		id: "rat-roi",
		page: 15,
		tier: 2,
		name: "Le Roi de rats",
		points: 400,
		description:
			"Boule grouillante de gros rats noirs dont les queues sont nouées en un seul nœud, qui luit faiblement en son cœur. Elle roule dans le noir, entend tout et regarde dans toutes les directions à la fois.",
		danger:
			"Mord au contact (20 dégâts). La lumière d'une lanterne l'éparpille en une nuée de rats qui mordent tous ceux qui passent au milieu, puis il se reforme quelques secondes après le retour de l'obscurité.",
		hostile: true,
		calmSpeed: 1.6,
		hostileSpeed: 4.4,
		damage: 20,
		attack: "melee",
		attackRange: 1.35,
		windupMs: 600,
		recoveryMs: 1100,
		viewRange: 9,
		fieldOfView: Math.PI * 2,
		hearing: 1.35,
		canOpenDoors: false,
		flying: false,
		bodyHeight: 0.8,
		aimRadius: 0.5,
		capture: capture({ lantern: "closed", maxRange: 4.5 }),
	},
};

export const SPECIES_LIST: SpeciesDefinition[] = SPECIES_IDS.map(
	(id) => SPECIES[id],
);

export function speciesIndex(id: SpeciesId): number {
	return SPECIES_IDS.indexOf(id);
}
