import type { SynthKit } from "../synthKit.js";

export interface SoundRecipe {
	id: string;
	duration: number;
	variants: number;
	loop?: boolean;
	render: (kit: SynthKit, variant: number) => void;
}
