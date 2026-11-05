export const DEFAULT_PLAYER_NAMES: readonly string[] = [
	"Morille Hardie",
	"Cèpe Bougon",
	"Girolle Vive",
	"Amanite Rieuse",
	"Pleurote Lunaire",
	"Trompette Noire",
	"Truffe Discrète",
	"Coulemelle",
	"Vesse-de-Loup",
	"Pied-Bleu",
	"Russule Rouge",
	"Mousseron Futé",
	"Lactaire Doux",
	"Clavaire Dorée",
	"Bolet Bai",
	"Craterelle",
	"Shiitaké Pressé",
	"Hydne Hérissé",
];

export function randomDefaultName(exclude: string[] = []): string {
	const options = DEFAULT_PLAYER_NAMES.filter(
		(name) => !exclude.includes(name),
	);
	return (
		options[Math.floor(Math.random() * options.length)] ??
		DEFAULT_PLAYER_NAMES[0]
	);
}
