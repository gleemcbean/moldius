import { useState } from "react";
import { Segmented } from "../../components/Controls";
import { Modal } from "../../components/Modal";
import { PageSwap } from "../../components/PageSwap";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { sessionStore } from "../network/sessionStore";
import { AudioSettings } from "./AudioSettings";
import { ControlsSettings } from "./ControlsSettings";
import { DevSettings } from "./DevSettings";
import { DisplaySettings } from "./DisplaySettings";
import styles from "./SettingsModal.module.scss";

type Tab = "controls" | "display" | "audio" | "dev";

const TABS: readonly Tab[] = ["controls", "display", "audio", "dev"];

export function SettingsModal({ onClose }: { onClose: () => void }) {
	const t = useT();
	const [tab, setTab] = useState<Tab>("controls");
	const dev = useStore(sessionStore, (state) => state.dev);
	return (
		<Modal title={t.settings.title} onClose={onClose} wide>
			<div className={styles.tabs}>
				<Segmented<Tab>
					value={tab}
					onChange={setTab}
					options={[
						{ value: "controls", label: t.settings.tabs.controls },
						{ value: "display", label: t.settings.tabs.display },
						{ value: "audio", label: t.settings.tabs.audio },
						...(dev
							? [{ value: "dev" as const, label: t.settings.tabs.dev }]
							: []),
					]}
				/>
			</div>
			<PageSwap page={tab} order={TABS}>
				{tab === "controls" ? <ControlsSettings /> : null}
				{tab === "display" ? <DisplaySettings /> : null}
				{tab === "audio" ? <AudioSettings /> : null}
				{tab === "dev" && dev ? <DevSettings /> : null}
			</PageSwap>
		</Modal>
	);
}
