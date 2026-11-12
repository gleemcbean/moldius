import type { ReactNode } from "react";
import { useT } from "../../i18n";
import styles from "./ProfileLink.module.scss";
import { openProfile } from "./profileViewStore";

export function ProfileLink({
	profileId,
	name,
	className,
	children,
}: {
	profileId: string | null | undefined;
	name: string;
	className?: string;
	children: ReactNode;
}) {
	const t = useT();
	if (!profileId) {
		return <span className={className}>{children}</span>;
	}
	return (
		<button
			type="button"
			className={[styles.link, className ?? ""].filter(Boolean).join(" ")}
			title={t.progression.profile.open(name)}
			onClick={(event) => {
				event.stopPropagation();
				openProfile(profileId);
			}}
			data-selectable="row"
		>
			{children}
		</button>
	);
}
