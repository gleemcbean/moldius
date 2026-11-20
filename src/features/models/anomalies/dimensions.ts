export const REVERBERE_HIP = 1.0;

export const REVERBERE_BEAMS: [number, number, number][] = [
	[1.05, 3.6, 0.1],
	[0.5, 3.1, 0.14],
];

export const COLLECTEUR_HIPS = 1.2;
export const ROD_HEIGHT = 1.37;
export const SAC_SCALE = 0.72;
export const BRAZIER_HEIGHT = 1.12;
export const BRAZIER_LIFT = 2.5;
export const BRAZIER_KNEE = -2.38;
export const ARCHIVIST_BOOKS = 9;
export const ARCHIVIST_PAGES = 12;

export const MIST_PUFFS: [number, number, number, number][] = [
	[0, 1.02, 0.02, 0.27],
	[-0.21, 0.86, -0.04, 0.24],
	[0.22, 0.84, -0.02, 0.23],
	[0, 0.72, -0.05, 0.3],
	[-0.05, 0.48, -0.1, 0.24],
	[0.04, 0.29, -0.16, 0.18],
	[-0.03, 0.14, -0.24, 0.12],
	[0.02, 0.04, -0.32, 0.075],
];

export const MIST_SHELL_COUNT = 4;
export const RAT_SCALE = 0.9;
export const RAT_KNOT_HEIGHT = 0.2;

export const RAT_LAYOUT: [number, number, number][] = [
	[0, 0.05, 0.3],
	[1.05, 0.02, -0.4],
	[2.1, 0.06, 0.5],
	[3.15, 0.03, -0.2],
	[4.2, 0.05, 0.45],
	[5.25, 0.02, -0.5],
	[0.5, 0.62, -0.7],
	[1.75, 0.58, 0.6],
	[3.0, 0.66, -0.5],
	[4.25, 0.6, 0.8],
	[5.5, 0.64, -0.3],
	[1.1, 1.15, 1.2],
	[3.2, 1.2, -1.1],
	[5.2, 1.1, 0.9],
];

export const ANT_HIP_HEIGHT = 0.62;
export const ANT_GASTER_Z = -0.42;

export interface AntLeg {
	side: 1 | -1;
	pair: 0 | 1 | 2;
	z: number;
	splay: number;
	reach: number;
}

export const ANT_LEGS: AntLeg[] = [0, 1, 2].flatMap((pair) =>
	([1, -1] as const).map((side) => ({
		side,
		pair: pair as AntLeg["pair"],
		z: [0.19, 0.02, -0.15][pair],
		splay: [0.62, 0.05, -0.55][pair],
		reach: [0.6, 0.68, 0.76][pair],
	})),
);

export const CINEMA_BODY_HEIGHT = 1.42;
export const CINEMA_HIP_RADIUS = 0.2;
export const CINEMA_LEG_ANGLES = [Math.PI / 6, (Math.PI * 5) / 6, -Math.PI / 2];
