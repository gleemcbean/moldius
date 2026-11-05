import type { SynthKit } from "../synthKit";

export interface SoundRecipe {
	id: string;
	duration: number;
	variants: number;
	loop?: boolean;
	render: (kit: SynthKit, variant: number) => void;
}
