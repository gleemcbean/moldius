import * as THREE from "three";

export const FACADE_Z = -26;
export const TOWER_FRONT_Z = -23;
export const TOWER_Z = TOWER_FRONT_Z - 2.5;
export const START_Z = 5;
export const PORCH_Z = -20.6;
export const GATE_Z = 2;
export const PATH_LENGTH = START_Z - PORCH_Z;

export const MAIN_DEPTH = 10;
export const MAIN_Z = FACADE_Z - MAIN_DEPTH / 2;
export const TURRET_X = 9;
export const WING_X = 13;

export const TOWER_TOP = new THREE.Vector3(0, 19.5, -25.5);
export const SPIRE_TIP = new THREE.Vector3(0, 30.2, TOWER_Z);
export const SIGIL_CENTER = new THREE.Vector3(0, 15, TOWER_FRONT_Z + 0.08);

export const MOON_DIRECTION = new THREE.Vector3(0.36, 0.4, -1).normalize();

export const SECOND_MOON_DIRECTION = new THREE.Vector3(
	-0.55,
	0.62,
	-1,
).normalize();

export const MOON_LIGHT_FROM = new THREE.Vector3(24, 30, 16);
export const SKY_RADIUS = 160;
