import { type ReactNode, useEffect, useRef } from "react";
import { useT } from "../i18n";
import { Icon } from "./Icon";
import styles from "./Modal.module.scss";
import { SelectorGroup } from "./SelectorGroup";

/** Échap ne ferme que la fenêtre du dessus, quand un profil s'ouvre par-dessus un classement. */
const openModals: symbol[] = [];

export function Modal({
	title,
	onClose,
	children,
	wide = false,
	dismissible = true,
}: {
	title: string;
	onClose: () => void;
	children: ReactNode;
	wide?: boolean;
	dismissible?: boolean;
}) {
	const t = useT();
	const closeRef = useRef(onClose);
	closeRef.current = onClose;
	useEffect(() => {
		if (!dismissible) {
			return;
		}
		const token = Symbol("modal");
		openModals.push(token);
		const onKey = (event: KeyboardEvent) => {
			if (event.code === "Escape" && openModals.at(-1) === token) {
				event.stopPropagation();
				closeRef.current();
			}
		};
		window.addEventListener("keydown", onKey, true);
		return () => {
			window.removeEventListener("keydown", onKey, true);
			openModals.splice(openModals.indexOf(token), 1);
		};
	}, [dismissible]);

	return (
		<div
			className={styles.backdrop}
			onPointerDown={(event) =>
				dismissible && event.target === event.currentTarget && onClose()
			}
		>
			<SelectorGroup
				className={[styles.modal, wide ? styles.wide : ""].join(" ")}
			>
				<header className={styles.header}>
					<h2>{title}</h2>
					{dismissible ? (
						<button
							type="button"
							className={styles.close}
							onClick={onClose}
							aria-label={t.common.close}
							data-selectable=""
						>
							<Icon name="close" />
						</button>
					) : null}
				</header>
				<div className={styles.body}>{children}</div>
			</SelectorGroup>
		</div>
	);
}
