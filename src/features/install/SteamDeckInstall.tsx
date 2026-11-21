import { useState } from "react";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { useT } from "../../i18n";
import { promptInstall, steamDeckCommand } from "./installStore";
import styles from "./SteamDeckInstall.module.scss";

export function SteamDeckInstall({ onClose }: { onClose: () => void }) {
	const t = useT();
	const labels = t.home.steamDeck;
	const [copied, setCopied] = useState(false);
	const command = steamDeckCommand(window.location.origin, import.meta.env.DEV);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(command);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	};

	return (
		<Modal title={labels.title} onClose={onClose}>
			<p className={styles.intro}>{labels.intro}</p>

			<ol className={styles.steps}>
				<li>{labels.openKonsole}</li>
				<li>{labels.paste}</li>
				<li>{labels.play}</li>
			</ol>

			<code className={styles.command}>{command}</code>

			<Button
				wide
				icon={<Icon name={copied ? "check" : "copy"} />}
				onClick={copy}
			>
				{copied ? labels.copied : labels.copy}
			</Button>

			<p className={styles.fallback}>{labels.fallback}</p>

			<Button
				variant="secondary"
				size="small"
				wide
				icon={<Icon name="download" />}
				onClick={promptInstall}
			>
				{labels.launcher}
			</Button>
		</Modal>
	);
}
