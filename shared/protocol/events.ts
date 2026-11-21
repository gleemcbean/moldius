import type { MatchMetrics } from "../challenges.js";
import type { DevModes } from "../devModes.js";
import type { MatchConfig } from "../matchConfig.js";
import type { TutorialStage } from "../tutorial.js";
import type { FriendInvite, FriendsOverview } from "./friends.js";
import type {
	CastRequest,
	CastResult,
	ClientStateMessage,
	FilmReport,
	ForcedMove,
	GameEvent,
	GhostActionKind,
	InteractRequest,
	MatchBegin,
	MatchInit,
	MatchResults,
	PingRequest,
	PlayerInventory,
	PowerRequest,
	RoleInfo,
	TimeSyncPing,
	TimeSyncPong,
	WorldSnapshot,
} from "./game.js";
import type {
	JoinPrivateRequest,
	JoinRequest,
	LobbyError,
	LobbyState,
	SessionInfo,
	VoiceRelayFrame,
	VoiceRelayRequest,
	VoiceSignalEnvelope,
} from "./lobby.js";
import type {
	SpeechAudioRequest,
	SpeechPrepareRequest,
	SpeechPrepareResult,
	SpeechReply,
	SpeechStartRequest,
} from "./speech.js";

export type Ack<T> = (
	response: { ok: true; value: T } | { ok: false; error: LobbyError },
) => void;

export interface ClientToServerEvents {
	"session:hello": (
		payload: { sessionToken: string | null },
		ack: Ack<SessionInfo>,
	) => void;
	"lobby:quickJoin": (payload: JoinRequest, ack: Ack<LobbyState>) => void;
	"lobby:createPrivate": (payload: JoinRequest, ack: Ack<LobbyState>) => void;
	"lobby:createDaily": (payload: JoinRequest, ack: Ack<LobbyState>) => void;
	"lobby:joinPossessed": (payload: JoinRequest, ack: Ack<LobbyState>) => void;
	"lobby:joinPrivate": (
		payload: JoinPrivateRequest,
		ack: Ack<LobbyState>,
	) => void;
	"lobby:joinPublic": (
		payload: JoinRequest & { lobbyId: string },
		ack: Ack<LobbyState>,
	) => void;
	"lobby:startTutorial": (payload: JoinRequest, ack: Ack<LobbyState>) => void;
	"friends:list": (ack: Ack<FriendsOverview>) => void;
	"friends:add": (payload: { code: string }, ack: Ack<FriendsOverview>) => void;
	"friends:respond": (
		payload: { accountId: string; accept: boolean },
		ack: Ack<FriendsOverview>,
	) => void;
	"friends:remove": (
		payload: { accountId: string },
		ack: Ack<FriendsOverview>,
	) => void;
	"friends:setOffline": (
		payload: { offline: boolean },
		ack: Ack<FriendsOverview>,
	) => void;
	"friends:invite": (payload: { accountId: string }, ack: Ack<null>) => void;
	"friends:request": (
		payload: { accountId: string },
		ack: Ack<FriendsOverview>,
	) => void;
	"friends:discordSync": (
		payload: { discordId: string; friendIds: string[] },
		ack: Ack<FriendsOverview>,
	) => void;
	"lobby:joinFriend": (
		payload: JoinRequest & { lobbyId: string },
		ack: Ack<LobbyState>,
	) => void;
	"lobby:openToFriends": (
		payload: { open: boolean },
		ack: Ack<LobbyState>,
	) => void;
	"lobby:leave": () => void;
	"lobby:ready": (payload: { ready: boolean }) => void;
	"lobby:microphone": (payload: { ready: boolean }) => void;
	"lobby:config": (
		payload: { config: MatchConfig },
		ack: Ack<LobbyState>,
	) => void;
	"lobby:team": (payload: { team: number }) => void;
	"lobby:kick": (
		payload: { playerId: string; ban: boolean },
		ack: Ack<null>,
	) => void;
	"lobby:promote": (payload: { playerId: string }, ack: Ack<null>) => void;
	"lobby:assignTeam": (
		payload: { playerId: string; team: number },
		ack: Ack<null>,
	) => void;
	"lobby:start": (ack: Ack<null>) => void;
	"voice:signal": (payload: VoiceSignalEnvelope) => void;
	"voice:relay": (payload: VoiceRelayRequest) => void;
	"speech:prepare": (
		payload: SpeechPrepareRequest,
		ack: (result: SpeechPrepareResult) => void,
	) => void;
	"speech:start": (payload: SpeechStartRequest) => void;
	"speech:audio": (payload: SpeechAudioRequest) => void;
	"speech:end": (payload: { id: string }) => void;
	"speech:cancel": (payload: { id: string }) => void;
	"time:ping": (payload: TimeSyncPing) => void;
	"game:loaded": (payload: { matchId: string; layoutChecksum: number }) => void;
	"game:layoutRequest": (payload: { matchId: string }) => void;
	"game:state": (payload: ClientStateMessage) => void;
	"game:lantern": (payload: { open: boolean }) => void;
	"game:interact": (payload: InteractRequest) => void;
	"game:castBegin": () => void;
	"game:castCancel": () => void;
	"game:cast": (payload: CastRequest) => void;
	"game:push": (payload: { yaw: number }) => void;
	"game:shout": () => void;
	"game:radio": (payload: { on: boolean }) => void;
	"game:craft": (payload: { altarId: number; object: string }) => void;
	"game:tutorial": (payload: { stage: TutorialStage }) => void;
	"game:devModes": (payload: DevModes) => void;
	"game:ping": (payload: PingRequest) => void;
	"game:emote": (payload: { emote: string | null }) => void;
	"game:gift": (payload: { targetId: string; material: string }) => void;
	"game:ghost": (payload: { kind: GhostActionKind; id: number }) => void;
	"game:power": (payload: PowerRequest) => void;
	"game:vote": (payload: { targetId: string }) => void;
	"game:film": (payload: FilmReport) => void;
	"game:leave": () => void;
}

export type AbortReason = "all-left" | "all-disconnected" | "layout-mismatch";

export interface ServerToClientEvents {
	"lobby:state": (state: LobbyState) => void;
	"lobby:kicked": (payload: { lobbyId: string; banned: boolean }) => void;
	"friends:changed": () => void;
	"friends:invited": (invite: FriendInvite) => void;
	"voice:signal": (payload: VoiceSignalEnvelope) => void;
	"voice:relay": (payload: VoiceRelayFrame) => void;
	"speech:reply": (reply: SpeechReply) => void;
	"time:pong": (payload: TimeSyncPong) => void;
	"game:init": (payload: MatchInit) => void;
	"game:layout": (payload: { matchId: string; layoutJson: string }) => void;
	"game:begin": (payload: MatchBegin) => void;
	"game:snapshot": (payload: WorldSnapshot) => void;
	"game:events": (payload: { t: number; events: GameEvent[] }) => void;
	"game:forcedMove": (payload: ForcedMove) => void;
	"game:castResult": (payload: CastResult) => void;
	"game:inventory": (payload: PlayerInventory) => void;
	"game:challenges": (payload: MatchMetrics) => void;
	"game:role": (payload: RoleInfo) => void;
	"game:end": (payload: MatchResults) => void;
	"game:aborted": (payload: { reason: AbortReason }) => void;
}
