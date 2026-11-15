import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.scss";

export type ButtonVariant =
	| "primary"
	| "secondary"
	| "ghost"
	| "danger"
	| "dangerGhost";

const VARIANT_SOUNDS: Record<ButtonVariant, string | undefined> = {
	primary: "confirm",
	secondary: undefined,
	ghost: undefined,
	danger: "danger",
	dangerGhost: "danger",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: "small" | "medium" | "large";
	icon?: ReactNode;
	wide?: boolean;
}

export function Button({
	variant = "primary",
	size = "medium",
	icon,
	wide = false,
	className,
	children,
	type = "button",
	...rest
}: ButtonProps) {
	const classes = [
		styles.button,
		styles[variant],
		styles[size],
		wide ? styles.wide : "",
		className ?? "",
	]
		.filter(Boolean)
		.join(" ");
	return (
		<button
			type={type}
			className={classes}
			data-selectable=""
			data-sound={VARIANT_SOUNDS[variant]}
			{...rest}
		>
			{icon ? <span className={styles.icon}>{icon}</span> : null}
			<span className={styles.label}>{children}</span>
		</button>
	);
}
