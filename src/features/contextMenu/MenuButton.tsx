import { Icon } from "../../components/Icon";
import { type MenuBuilder, toggleMenuBelow } from "./contextMenuStore";
import styles from "./MenuButton.module.scss";

export function MenuButton({
	build,
	label,
	className,
}: {
	build: MenuBuilder;
	label: string;
	className?: string;
}) {
	return (
		<button
			type="button"
			className={[styles.button, className ?? ""].join(" ")}
			aria-label={label}
			aria-haspopup="menu"
			title={label}
			onClick={(event) => {
				event.stopPropagation();
				toggleMenuBelow(event.currentTarget, build, event.detail === 0);
			}}
			data-selectable=""
		>
			<Icon name="more" />
		</button>
	);
}
