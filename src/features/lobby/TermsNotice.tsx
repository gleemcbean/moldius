import { useState } from "react";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { acceptTerms } from "../account/accountStore";
import { settingsStore } from "../settings/settingsStore";
import styles from "./LobbyScreen.module.scss";

/** Demandé une fois, au premier lobby : on accepte les conditions ou on repart. */
export function TermsNotice({ onLeave }: { onLeave: () => void }) {
	const t = useT();
	const labels = t.lobby.termsNotice;
	const language = useStore(settingsStore, (state) => state.language);
	const [saving, setSaving] = useState(false);
	const [failed, setFailed] = useState(false);
	const accept = async () => {
		setSaving(true);
		setFailed(false);
		if (!(await acceptTerms())) {
			setFailed(true);
			setSaving(false);
		}
	};
	return (
		<Modal title={labels.title} onClose={onLeave} dismissible={false}>
			<div className={styles.termsNotice}>
				<p>{labels.question}</p>
				<p>{labels.recording}</p>
				<p>
					<strong>{labels.deletion}</strong>
				</p>
				<a href={`/terms?lang=${language}`} target="_blank" rel="noreferrer">
					{labels.terms}
				</a>
				{failed ? <p role="alert">{labels.failed}</p> : null}
				<div className={styles.termsNoticeActions}>
					<Button variant="ghost" onClick={onLeave}>
						{labels.leave}
					</Button>
					<Button size="large" disabled={saving} onClick={() => void accept()}>
						{labels.accept}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
