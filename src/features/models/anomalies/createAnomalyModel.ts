import type { SpeciesId } from "@shared/config/species";
import { DEFAULT_HAT_PATTERN, type HatPattern } from "@shared/hatPatterns";
import type { ModelKit } from "../modelKit";
import type { AnomalyModel } from "./AnomalyModel";
import { CollecteurModel, MurmureModel, ReverbereModel } from "./bipeds";
import {
	ArchivisteModel,
	BoursoufleModel,
	BrasierModel,
	DoubleModel,
	FeuFolletModel,
	HurleurModel,
	SuinteurModel,
} from "./creatures";
import {
	BrumeModel,
	ColosseModel,
	FulgurantModel,
	PleureuseModel,
	RatRoiModel,
} from "./newcomers";

export function createAnomalyModel(
	species: SpeciesId,
	kit: ModelKit,
	mimicColor = 0xd8442f,
	mimicPattern: HatPattern = DEFAULT_HAT_PATTERN,
	mimicLantern: number | null = null,
): AnomalyModel {
	switch (species) {
		case "murmure":
			return new MurmureModel(kit);
		case "veilleur":
			return new ReverbereModel(kit);
		case "crache-cendre":
			return new BrasierModel(kit);
		case "collecteur":
			return new CollecteurModel(kit);
		case "archiviste":
			return new ArchivisteModel(kit);
		case "luciole":
			return new FeuFolletModel(kit);
		case "double":
			return new DoubleModel(kit, mimicColor, mimicPattern, mimicLantern);
		case "hurleur":
			return new HurleurModel(kit);
		case "suinteur":
			return new SuinteurModel(kit);
		case "boursoufle":
			return new BoursoufleModel(kit);
		case "colosse":
			return new ColosseModel(kit);
		case "fulgurant":
			return new FulgurantModel(kit);
		case "gorgone":
			return new PleureuseModel(kit);
		case "brume":
			return new BrumeModel(kit);
		case "rat-roi":
			return new RatRoiModel(kit);
	}
}
