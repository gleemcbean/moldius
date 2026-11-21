import * as THREE from "three";

export const START_Z = 5;
export const GATE_Z = 2;
export const PORCH_Z = -20.6;
export const ENTRANCE_Z = -23;
export const FACADE_Z = -30;
export const MAIN_Z = FACADE_Z - 8;
export const PATH_LENGTH = START_Z - PORCH_Z;
export const CAMERA_TRAIL = 6.8;

export const DOOR_HALF_WIDTH = 1.4;
export const DOOR_HEIGHT = 4.4;
export const TOWER_WALL = 33;
export const MANOR_HALF_WIDTH = 37.5;

export const TOWER_TOP = new THREE.Vector3(0, TOWER_WALL, MAIN_Z);

export const FAIRY_RING = { x: 7.2, z: -10.5, radius: 2.1 };

export const GRAVEYARDS = [
	{ minX: -12, maxX: -5, minZ: -15, maxZ: -7, stones: 7 },
	{ minX: 5, maxX: 10, minZ: -12, maxZ: -7, stones: 4 },
] as const;

export const MOON_DIRECTION = new THREE.Vector3(0.23, 0.77, -1).normalize();

export const SECOND_MOON_DIRECTION = new THREE.Vector3(
	-0.65,
	0.78,
	-1,
).normalize();

export const MOON_LIGHT_FROM = new THREE.Vector3(39.4, 49.3, 31.3);
export const MOON_LIGHT_TARGET = new THREE.Vector3(0, 0, -18);
export const SKY_RADIUS = 160;
