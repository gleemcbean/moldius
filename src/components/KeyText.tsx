import {
	FACE_COLORS,
	FACE_LETTER_WIDTH,
	FACE_LETTERS,
	FACE_RING_RADIUS,
	FACE_RING_WIDTH,
	GLYPH_BACKING,
	GLYPH_DIM,
	GLYPH_INK,
	isFaceGlyph,
	type PadGlyph,
	splitGlyphs,
} from "../features/gamepad/padGlyphs";
import styles from "./KeyText.module.scss";

const CROSS = "M7 1h6v6h6v6h-6v6H7v-6H1V7h6z";

const ARMS: Record<Exclude<PadGlyph, "a" | "b" | "x" | "y">, string> = {
	up: "M7.9 1.9h4.2v7.2H7.9z",
	down: "M7.9 10.9h4.2v7.2H7.9z",
	left: "M1.9 7.9h7.2v4.2H1.9z",
	right: "M10.9 7.9h7.2v4.2h-7.2z",
};

export function PadGlyphIcon({ glyph }: { glyph: PadGlyph }) {
	if (isFaceGlyph(glyph)) {
		const color = FACE_COLORS[glyph];
		return (
			<svg className={styles.glyph} viewBox="0 0 20 20" aria-hidden="true">
				<circle
					cx="10"
					cy="10"
					r={FACE_RING_RADIUS}
					fill={GLYPH_BACKING}
					stroke={color}
					strokeWidth={FACE_RING_WIDTH}
				/>
				<path
					d={FACE_LETTERS[glyph]}
					fill="none"
					stroke={color}
					strokeWidth={FACE_LETTER_WIDTH}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}
	return (
		<svg className={styles.glyph} viewBox="0 0 20 20" aria-hidden="true">
			<path
				d={CROSS}
				fill={GLYPH_BACKING}
				stroke={GLYPH_DIM}
				strokeWidth="1.4"
				strokeLinejoin="round"
			/>
			<path d={ARMS[glyph]} fill={GLYPH_INK} />
		</svg>
	);
}

export function KeyText({ text }: { text: string }) {
	const runs = splitGlyphs(text);
	if (runs.every((run) => "text" in run)) {
		return <>{text}</>;
	}
	let offset = 0;
	const keyed = runs.map((run) => {
		const at = offset;
		offset += "glyph" in run ? 1 : run.text.length;
		return { at, run };
	});
	return (
		<>
			{keyed.map(({ at, run }) =>
				"glyph" in run ? (
					<PadGlyphIcon key={at} glyph={run.glyph} />
				) : (
					<span key={at}>{run.text}</span>
				),
			)}
		</>
	);
}
