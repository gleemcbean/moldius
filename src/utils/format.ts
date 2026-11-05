export function formatClock(milliseconds: number): string {
	const total = Math.max(0, Math.ceil(milliseconds / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatPoints(points: number): string {
	return points.toLocaleString("fr-FR");
}

export function romanNumeral(value: number): string {
	const numerals: [number, string][] = [
		[10, "X"],
		[9, "IX"],
		[5, "V"],
		[4, "IV"],
		[1, "I"],
	];
	let remaining = value;
	let result = "";
	for (const [amount, symbol] of numerals) {
		while (remaining >= amount) {
			result += symbol;
			remaining -= amount;
		}
	}
	return result;
}

export function hexColor(value: number): string {
	return `#${value.toString(16).padStart(6, "0")}`;
}
