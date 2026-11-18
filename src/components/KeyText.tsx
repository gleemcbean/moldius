import {
	FACE_COLORS,
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
					r="9"
					fill={GLYPH_BACKING}
					stroke={color}
					strokeWidth="2"
				/>
				<text
					x="10"
					y="10.6"
					fill={color}
					fontSize="12"
					fontWeight="800"
					fontFamily="inherit"
					textAnchor="middle"
					dominantBaseline="middle"
				>
					{glyph.toUpperCase()}
				</text>
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
