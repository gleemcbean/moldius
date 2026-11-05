import type { LobbyPlayerInfo, LobbyState } from "@shared/protocol/lobby";
import { TEAM_COLORS } from "@shared/teams";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { useStore } from "../../hooks/useStore";
import { type Messages, useT } from "../../i18n";
import { hexColor } from "../../utils/format";
import { micStore } from "../voice/micManager";
import { voiceStore } from "../voice/voiceChat";
import styles from "./LobbyScreen.module.scss";
import { chooseTeam } from "./lobbyClient";

function SpeakingDot({ playerId, self }: { playerId: string; self: boolean }) {
	const remote = useStore(
		voiceStore,
		(state) => state.peers[playerId]?.level ?? 0,
	);
	const local = useStore(micStore, (state) => (self ? state.level : 0));
	const level = self ? local : remote;
	return (
		<span
			className={styles.speaking}
			style={{
				opacity: level > 0.12 ? 1 : 0.2,
				transform: `scale(${1 + Math.min(level, 1) * 0.6})`,
			}}
		/>
	);
}

const LINK_LABELS: Partial<
	Record<RTCPeerConnectionState, keyof Messages["lobby"]["voice"]>
> = {
	new: "connecting",
	connecting: "connecting",
	connected: "connected",
	disconnected: "interrupted",
	failed: "unavailable",
};

function VoiceLink({ playerId }: { playerId: string }) {
	const t = useT();
	const state = useStore(
		voiceStore,
		(voice) => voice.peers[playerId]?.state ?? null,
	);
	const key = state ? LINK_LABELS[state] : undefined;
	const label = key ? t.lobby.voice[key] : undefined;
	if (!label) {
		return null;
	}
	const className =
		state === "connected"
			? styles.micOk
			: state === "failed" || state === "disconnected"
				? styles.micMissing
				: styles.linkPending;
	return <span className={className}>{label}</span>;
}

function Occupied({
	player,
	host,
	self,
}: {
	player: LobbyPlayerInfo;
	host: boolean;
	self: boolean;
}) {
	const t = useT();
	return (
		<li className={[styles.slot, self ? styles.self : ""].join(" ")}>
			<span className={styles.capPreview}>
				<HatPreview color={player.color} pattern={player.pattern} />
			</span>
			<span className={styles.slotBody}>
				<span className={styles.slotName}>
					{player.name}
					{self ? <span className={styles.you}>{t.lobby.you}</span> : null}
				</span>
				<span className={styles.slotMeta}>
					{player.team !== null ? (
						<span
							className={styles.teamTag}
							style={{ borderColor: hexColor(TEAM_COLORS[player.team]) }}
						>
							{t.common.teams[player.team]}
						</span>
					) : null}
					{host ? (
						<span className={styles.host}>
							<Icon name="crown" /> {t.lobby.host}
						</span>
					) : null}
					<span className={player.micReady ? styles.micOk : styles.micMissing}>
						<Icon name={player.micReady ? "mic" : "micOff"} />{" "}
						{player.micReady ? t.lobby.micOn : t.lobby.micOff}
					</span>
					{!self && player.connected ? (
						<VoiceLink playerId={player.id} />
					) : null}
					{!player.connected ? (
						<span className={styles.micMissing}>{t.lobby.disconnected}</span>
					) : null}
				</span>
			</span>
			<SpeakingDot playerId={player.id} self={self} />
			<span
				className={[styles.readyTag, player.ready ? styles.readyOn : ""].join(
					" ",
				)}
			>
				{player.ready ? t.lobby.ready : t.lobby.waiting}
			</span>
		</li>
	);
}

export function PlayerSlots({
	lobby,
	selfId,
}: {
	lobby: LobbyState;
	selfId: string | null;
}) {
	const t = useT();
	const free = Math.max(0, lobby.capacity - lobby.players.length);
	const me = lobby.players.find((player) => player.id === selfId);
	const teams = Array.from(
		{ length: lobby.config.teamCount },
		(_, team) => team,
	);
	return (
		<>
			{lobby.config.teamCount > 0 && me ? (
				<div className={styles.teamPicker}>
					<span className={styles.teamPickerLabel}>{t.lobby.team}</span>
					{teams.map((team) => (
						<button
							key={team}
							type="button"
							className={[
								styles.teamChoice,
								me.team === team ? styles.teamChoiceOn : "",
							].join(" ")}
							style={{ borderColor: hexColor(TEAM_COLORS[team]) }}
							disabled={lobby.phase !== "waiting"}
							aria-pressed={me.team === team}
							onClick={() => chooseTeam(team)}
							data-selectable=""
						>
							{t.common.teams[team]}
							<span className={styles.chipCount}>
								{lobby.players.filter((player) => player.team === team).length}
							</span>
						</button>
					))}
				</div>
			) : null}
			<ul className={styles.slots}>
				{lobby.players.map((player) => (
					<Occupied
						key={player.id}
						player={player}
						host={player.id === lobby.hostId}
						self={player.id === selfId}
					/>
				))}
				{Array.from({ length: free }, (_, index) => (
					<li
						key={`free-${index.toString()}`}
						className={[styles.slot, styles.free].join(" ")}
					>
						<span className={[styles.cap, styles.capEmpty].join(" ")} />
						<span className={styles.slotBody}>
							<span className={styles.slotName}>{t.lobby.freeSlot}</span>
							<span className={styles.slotMeta}>{t.lobby.freeSlotHint}</span>
						</span>
						<span className={styles.speaking} style={{ opacity: 0 }} />
						<span className={styles.readyTag}>-</span>
					</li>
				))}
			</ul>
		</>
	);
}
