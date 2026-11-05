import { useStore } from "../hooks/useStore";
import { appStore } from "./appStore";
import styles from "./Toasts.module.scss";

export function Toasts() {
	const toasts = useStore(appStore, (state) => state.toasts);
	return (
		<div className={styles.stack} aria-live="polite">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={[styles.toast, styles[toast.tone]].join(" ")}
				>
					{toast.text}
				</div>
			))}
		</div>
	);
}
