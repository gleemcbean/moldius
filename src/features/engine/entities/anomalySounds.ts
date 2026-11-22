import type { SpeciesId } from "@shared/config/species";

export const ANOMALY_IDLE_SOUNDS: Partial<Record<SpeciesId, string>> = {
	murmure: "murmure-idle",
	veilleur: "veilleur-idle",
	"crache-cendre": "cendre-idle",
	collecteur: "collecteur-idle",
	archiviste: "archiviste-idle",
	luciole: "luciole-idle",
	hurleur: "hurleur-wings",
	suinteur: "suinteur-idle",
	boursoufle: "boursoufle-idle",
	colosse: "colosse-idle",
	fulgurant: "fulgurant-idle",
	gorgone: "gorgone-idle",
	brume: "brume-idle",
	"rat-roi": "ratroi-idle",
	cordyceps: "cordyceps-idle",
	cinematographe: "cinema-idle",
	phalene: "phalene-idle",
};

export const ANOMALY_WINDUP_SOUNDS: Partial<Record<SpeciesId, string>> = {
	murmure: "murmure-attack",
	veilleur: "veilleur-windup",
	"crache-cendre": "cendre-windup",
	collecteur: "collecteur-windup",
	suinteur: "suinteur-windup",
	boursoufle: "boursoufle-inflate",
	double: "melee-swing",
	colosse: "colosse-windup",
	fulgurant: "fulgurant-charge",
	gorgone: "melee-swing",
	"rat-roi": "ratroi-bite",
	cordyceps: "cordyceps-windup",
	cinematographe: "cinema-charge",
	phalene: "phalene-windup",
};
