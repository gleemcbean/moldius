export function hazeFilter(haze: number): string | undefined {
	return haze > 0
		? `blur(${(haze * 6).toFixed(1)}px) brightness(${(1 - haze * 0.88).toFixed(2)})`
		: undefined;
}
