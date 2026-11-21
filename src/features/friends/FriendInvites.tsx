import { Button } from "../../components/Button";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { openContextMenu } from "../contextMenu/contextMenuStore";
import { invitationMenu } from "../contextMenu/socialMenus";
import styles from "./FriendInvites.module.scss";
import { acceptInvite, dismissInvite, friendsStore } from "./friendsStore";

export function FriendInvites() {
	const t = useT();
	const invites = useStore(friendsStore, (state) => state.invites);

	if (invites.length === 0) {
		return null;
	}

	return (
		<div className={styles.stack} aria-live="polite">
			{invites.map((invite) => (
				<div
					className={styles.card}
					key={invite.lobbyId + invite.fromAccountId}
					role="group"
					aria-label={t.friends.inviteFrom(invite.fromName)}
					onContextMenu={(event) =>
						openContextMenu(event, invitationMenu(invite))
					}
					data-context-menu=""
				>
					<p>{t.friends.inviteFrom(invite.fromName)}</p>
					<div className={styles.actions}>
						<Button onClick={() => acceptInvite(invite)}>
							{t.friends.inviteJoin}
						</Button>
						<Button variant="ghost" onClick={() => dismissInvite(invite)}>
							{t.friends.inviteDecline}
						</Button>
					</div>
				</div>
			))}
		</div>
	);
}
