import type { RoomType } from "../types.js";
import { alchemyRoom } from "./alchemy.js";
import { armoryRoom } from "./armory.js";
import { atticRoom } from "./attic.js";
import { ballroomRoom } from "./ballroom.js";
import { bathroomRoom } from "./bathroom.js";
import { bedroomRoom } from "./bedroom.js";
import { billiardRoom } from "./billiard.js";
import type { RoomBlueprint } from "./blueprint.js";
import { cartographyRoom } from "./cartography.js";
import { cellarRoom } from "./cellar.js";
import { chapelRoom } from "./chapel.js";
import { closetRoom } from "./closet.js";
import { collapsedWingRoom } from "./collapsedWing.js";
import { corridorRoom } from "./corridor.js";
import { cryptRoom } from "./crypt.js";
import { crystalGrottoRoom } from "./crystalGrotto.js";
import { curiositiesRoom } from "./curiosities.js";
import { diningRoom } from "./dining.js";
import { dungeonRoom } from "./dungeon.js";
import { enchantedLibraryRoom } from "./enchantedLibrary.js";
import { fairyRingRoom } from "./fairyRing.js";
import { fungalGreenhouseRoom } from "./fungalGreenhouse.js";
import { galleryRoom } from "./gallery.js";
import { greenhouseRoom } from "./greenhouse.js";
import { hallRoom } from "./hall.js";
import { horologyRoom } from "./horology.js";
import { infirmaryRoom } from "./infirmary.js";
import { kitchenRoom } from "./kitchen.js";
import { larderRoom } from "./larder.js";
import { laundryRoom } from "./laundry.js";
import { libraryRoom } from "./library.js";
import { mushroomCellarRoom } from "./mushroomCellar.js";
import { musicRoom } from "./music.js";
import { mycologyLabRoom } from "./mycologyLab.js";
import { nurseryRoom } from "./nursery.js";
import { observatoryRoom } from "./observatory.js";
import { pactRoom } from "./pact.js";
import { pondRoom } from "./pond.js";
import { reliquaryRoom } from "./reliquary.js";
import { ritualRoom } from "./ritual.js";
import { ruinedChapelRoom } from "./ruinedChapel.js";
import { salonRoom } from "./salon.js";
import { sanctuaryRoom } from "./sanctuary.js";
import { seanceRoom } from "./seance.js";
import { stairwellRoom } from "./stairwell.js";
import { studyRoom } from "./study.js";
import { theaterRoom } from "./theater.js";
import { toiletsRoom } from "./toilets.js";
import { undercroftRoom } from "./undercroft.js";
import { workshopRoom } from "./workshop.js";

export const ROOM_BLUEPRINTS: Record<RoomType, RoomBlueprint> = {
	hall: hallRoom,
	salon: salonRoom,
	gallery: galleryRoom,
	corridor: corridorRoom,
	library: libraryRoom,
	cellar: cellarRoom,
	kitchen: kitchenRoom,
	toilets: toiletsRoom,
	bedroom: bedroomRoom,
	bathroom: bathroomRoom,
	study: studyRoom,
	greenhouse: greenhouseRoom,
	alchemy: alchemyRoom,
	ritual: ritualRoom,
	music: musicRoom,
	dining: diningRoom,
	workshop: workshopRoom,
	chapel: chapelRoom,
	sanctuary: sanctuaryRoom,
	reliquary: reliquaryRoom,
	pact: pactRoom,
	closet: closetRoom,
	observatory: observatoryRoom,
	curiosities: curiositiesRoom,
	nursery: nurseryRoom,
	laundry: laundryRoom,
	crypt: cryptRoom,
	dungeon: dungeonRoom,
	pond: pondRoom,
	ballroom: ballroomRoom,
	theater: theaterRoom,
	armory: armoryRoom,
	billiard: billiardRoom,
	attic: atticRoom,
	undercroft: undercroftRoom,
	infirmary: infirmaryRoom,
	seance: seanceRoom,
	larder: larderRoom,
	cartography: cartographyRoom,
	horology: horologyRoom,
	mushroomCellar: mushroomCellarRoom,
	fungalGreenhouse: fungalGreenhouseRoom,
	mycologyLab: mycologyLabRoom,
	fairyRing: fairyRingRoom,
	collapsedWing: collapsedWingRoom,
	ruinedChapel: ruinedChapelRoom,
	crystalGrotto: crystalGrottoRoom,
	enchantedLibrary: enchantedLibraryRoom,
	stairwell: stairwellRoom,
};

export const ROOM_TYPE_IDS = Object.keys(ROOM_BLUEPRINTS) as RoomType[];

export function roomBlueprint(type: RoomType): RoomBlueprint {
	return ROOM_BLUEPRINTS[type];
}
