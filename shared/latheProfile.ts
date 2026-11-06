interface ProfilePoint {
	x: number;
	y: number;
}

/**
 * Met un profil de révolution dans le sens qui oriente ses faces vers l'extérieur.
 * Le contour se referme par l'axe : une corde directe entre les deux bouts
 * passerait à côté d'un pied fin et retournerait ses faces.
 */
export function orientLatheProfile<Point extends ProfilePoint>(
	input: Point[],
): Point[] {
	const outline: ProfilePoint[] = [
		...input,
		{ x: 0, y: input[input.length - 1].y },
		{ x: 0, y: input[0].y },
	];
	let area = 0;
	for (let index = 0; index < outline.length; index += 1) {
		const current = outline[index];
		const next = outline[(index + 1) % outline.length];
		area += current.x * next.y - next.x * current.y;
	}
	return area < 0 ? [...input].reverse() : input;
}
