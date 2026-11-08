import type { SVGProps } from "react";

export type IconName =
	| "mic"
	| "walkie"
	| "micOff"
	| "eye"
	| "crown"
	| "quote"
	| "copy"
	| "check"
	| "gear"
	| "code"
	| "door"
	| "play"
	| "users"
	| "user"
	| "lock"
	| "close"
	| "book"
	| "lantern"
	| "skull"
	| "speaker"
	| "discord"
	| "download";

export const ICON_PATHS: Record<IconName, string> = {
	walkie: "M10 0h1v4h2v12H3V4h7zM5 6v3h6V6zM5 11v1h6v-1zM5 13v1h6v-1z",
	mic: "M6 1h4v8H6zM4 7h1v2a3 3 0 0 0 6 0V7h1v2a4 4 0 0 1-3.5 4v2h-1v-2A4 4 0 0 1 4 9z",
	micOff:
		"M6 1h4v6L6 3zM2 1l13 13-1 1-4-4a4 4 0 0 1-1.5.9V15h-1v-2A4 4 0 0 1 4 9V7h1v2a3 3 0 0 0 4.2 2.8L1 2z",
	eye: "M8 3c4 0 7 5 7 5s-3 5-7 5-7-5-7-5 3-5 7-5zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z",
	crown: "M1 4l3.5 3L8 2l3.5 5L15 4l-2 9H3z",
	quote: "M1 3h6v6l-3 4H2l2-4H1zm8 0h6v6l-3 4h-2l2-4H9z",
	copy: "M5 1h9v10h-2V3H5zM2 4h9v11H2z",
	check: "M2 8l2-2 3 3 6-6 2 2-8 8z",
	gear: "M7 0h2l.4 2.2 1.6.7 1.9-1.3 1.4 1.4-1.3 1.9.7 1.6L16 7v2l-2.2.4-.7 1.6 1.3 1.9-1.4 1.4-1.9-1.3-1.6.7L9 16H7l-.4-2.2-1.6-.7-1.9 1.3-1.4-1.4 1.3-1.9-.7-1.6L0 9V7l2.2-.4.7-1.6-1.3-1.9 1.4-1.4 1.9 1.3 1.6-.7zm1 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
	code: "M5 3L0 8l5 5 1.4-1.4L2.8 8l3.6-3.6zm6 0L9.6 4.4 13.2 8l-3.6 3.6L11 13l5-5z",
	door: "M3 1h10v14H3zm2 2v10h6V3zm4 5h1v1H9z",
	play: "M3 1l11 7-11 7z",
	users:
		"M5 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm6 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM0 15c0-3 2-5 5-5s5 2 5 5zm11-5c2.5 0 5 1.5 5 5h-5c0-2-.6-3.6-1.7-4.7.5-.2 1.1-.3 1.7-.3z",
	user: "M8 1a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM1 15c0-3.6 3-6 7-6s7 2.4 7 6z",
	lock: "M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z",
	close: "M3 1l5 5 5-5 2 2-5 5 5 5-2 2-5-5-5 5-2-2 5-5-5-5z",
	book: "M1 2h5a2 2 0 0 1 2 2 2 2 0 0 1 2-2h5v11h-5a2 2 0 0 0-2 2 2 2 0 0 0-2-2H1z",
	lantern:
		"M6 0h4v2h2v2h1v9h-1v2H4v-2H3V4h1V2h2zm-1 5v7h6V5zm3 1c1 1.5 1.5 2.5 1.5 3.5a1.5 1.5 0 0 1-3 0C6.5 8.5 7 7.5 8 6z",
	skull:
		"M8 1c4 0 6 2.5 6 6 0 2-1 3.5-2 4v3H4v-3c-1-.5-2-2-2-4 0-3.5 2-6 6-6zM5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
	discord:
		"M13.5 3.2a12.7 12.7 0 0 0-3.1-1l-.4.8a11.8 11.8 0 0 0-4 0l-.4-.8a12.7 12.7 0 0 0-3.1 1C.5 6.1 0 9 .2 11.8a12.8 12.8 0 0 0 3.8 1.9l.8-1.3a8.2 8.2 0 0 1-1.3-.6l.3-.2a9.1 9.1 0 0 0 8.4 0l.3.2a8.2 8.2 0 0 1-1.3.6l.8 1.3a12.8 12.8 0 0 0 3.8-1.9c.3-3.3-.5-6.2-2.3-8.6zM5.4 10.1c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6zm5.2 0c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6z",
	speaker:
		"M1 5h3l5-4v14l-5-4H1zm10 0c1 .8 1.5 1.8 1.5 3s-.5 2.2-1.5 3l-1-1c.6-.5 1-1.2 1-2s-.4-1.5-1-2z",
	download: "M7 1h2v7.2l2.6-2.6L13 7l-5 5-5-5 1.4-1.4L7 8.2zM2 13h12v2H2z",
};

export function Icon({
	name,
	...rest
}: { name: IconName } & SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="currentColor"
			aria-hidden="true"
			shapeRendering="geometricPrecision"
			{...rest}
		>
			<path d={ICON_PATHS[name]} fillRule="evenodd" />
		</svg>
	);
}
