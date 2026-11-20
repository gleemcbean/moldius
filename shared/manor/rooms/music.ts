import { rotate2 } from "../../math.js";
import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	chandeliers,
	estradeWith,
	randomRugs,
	sideBySideCandles,
	windowsFor,
} from "./kit/placements.js";

function furnishMusic(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);

	const grand = furnisher.rng.chance(0.6)
		? estradeWith(furnisher, "grandPiano", 0, 1)
		: null;

	if (!grand) {
		furnisher.wallItemsBetween("uprightPiano", 1, 1);
	}

	furnisher.floorItemsBetween("harp", 0, 1, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("cello", 1, 2, { wallMargin: 0.4 });

	const stands = furnisher.floorItemsBetween("musicStand", 1, 3, {
		wallMargin: 1.0,
	});

	stands.forEach((stand) => {
		const local = rotate2({ x: 0, z: -0.65 }, stand.rotation);

		furnisher.floorItem("chair", {
			variant: 0,
			at: { x: stand.x + local.x, z: stand.z + local.z },
			rotation: stand.rotation + Math.PI,
		});
	});

	furnisher.floorItemsBetween("sofa", 0, 1, { wallMargin: 0.7 });
	furnisher.wallItemsBetween("curtainAlcove", 0, 1);
	sideBySideCandles(furnisher, furnisher.wallItem("cabinet"), 1, 2);
	furnisher.wallDecorBetween("painting", 1, 3);
	furnisher.wallDecorBetween("sconce", 1, 2);
	randomRugs(furnisher, 0, 1);
	chandeliers(furnisher, 1);
	furnisher.cobwebs(1, 2);
}

function addMusicExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("harpsichord", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("timpani", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("ovalPortrait", 0, 1);
}

export const musicRoom: RoomBlueprint = {
	catalog: {
		names: ["Salon de musique", "Salle de musique"],
		width: [6, 9],
		depth: [6, 8],
		heightGround: [3.4, 3.9],
		heightUpper: [3.0, 3.4],
		shapes: [
			["rect", 1],
			["heptagon", 1],
			["apse", 1],
		],
		floors: ["parquet"],
		walls: ["wallpaperOchre", "wallpaperRed", "woodPanels", "wallpaperStripes"],
		ceilings: ["coffered", "plaster"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Music Room", "Music Hall"],
	mapTint: "reception",
	spawnWeight: { ground: 0.9, upper: 0.9 },
	furnish: furnishMusic,
	extras: addMusicExtras,
	fillers: [
		["harp", "floor"],
		["cello", "floor"],
		["musicStand", "floor"],
		["armchair", "floor"],
		["sofa", "floor"],
		["pottedPlant", "floor"],
		["candelabra", "floor"],
		["uprightPiano", "wall"],
		["cabinet", "wall"],
	],
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
