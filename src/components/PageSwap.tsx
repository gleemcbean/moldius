import { type ReactNode, useState } from "react";
import styles from "./PageSwap.module.scss";

type Direction = "next" | "previous" | null;

/**
 * Le contenu d'un onglet : quand on en change, la nouvelle page glisse depuis le côté
 * de l'onglet choisi (la droite s'il est plus loin dans la liste). Rien au premier affichage.
 */
export function PageSwap<T extends string>({
	page,
	order,
	children,
}: {
	page: T;
	order: readonly T[];
	children: ReactNode;
}) {
	const [state, setState] = useState<{ page: T; direction: Direction }>({
		page,
		direction: null,
	});
	if (state.page !== page) {
		setState({
			page,
			direction:
				order.indexOf(page) >= order.indexOf(state.page) ? "next" : "previous",
		});
	}
	const direction = state.page === page ? state.direction : null;
	return (
		<div
			key={page}
			className={[styles.page, direction ? styles[direction] : ""].join(" ")}
		>
			{children}
		</div>
	);
}
