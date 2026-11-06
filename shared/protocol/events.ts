import type { DevModes } from "../devModes.js";
import type { MatchConfig } from "../matchConfig.js";
import type {
	FriendInvite,
	FriendsOverview,
	PublicLobbyPreview,
} from "./friends.js";
import type {
	CastRequest,
	CastResult,
	ClientStateMessage,
	ForcedMove,
	GameEvent,
	InteractRequest,
	MatchBegin,
	MatchInit,
	MatchResults,
	PlayerInventory,
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
	VoiceSignalEnvelope,
} from "./lobby.js";

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
	"lobby:joinPrivate": (
		payload: JoinPrivateRequest,
		ack: Ack<LobbyState>,
	) => void;
	"lobby:joinPublic": (
		payload: JoinRequest & { lobbyId: string },
		ack: Ack<LobbyState>,
	) => void;
	"lobby:peekPublic": (ack: Ack<PublicLobbyPreview>) => void;
	"lobby:startTutorial": (
		payload: { name: string },
		ack: Ack<LobbyState>,
	) => void;
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
	"lobby:leave": () => void;
	"lobby:ready": (payload: { ready: boolean }) => void;
	"lobby:microphone": (payload: { ready: boolean }) => void;
	"lobby:config": (
		payload: { config: MatchConfig },
		ack: Ack<LobbyState>,
	) => void;
	"lobby:team": (payload: { team: number }) => void;
	"lobby:start": (ack: Ack<null>) => void;
	"voice:signal": (payload: VoiceSignalEnvelope) => void;
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
	"game:craft": (payload: { altarId: number; object: string }) => void;
	"game:tutorialSummon": () => void;
	"game:tutorialWound": () => void;
	"game:devModes": (payload: DevModes) => void;
	"game:leave": () => void;
}

export type AbortReason = "all-left" | "all-disconnected" | "layout-mismatch";

export interface ServerToClientEvents {
	"lobby:state": (state: LobbyState) => void;
	"friends:changed": () => void;
	"friends:invited": (invite: FriendInvite) => void;
	"voice:signal": (payload: VoiceSignalEnvelope) => void;
	"time:pong": (payload: TimeSyncPong) => void;
	"game:init": (payload: MatchInit) => void;
	"game:layout": (payload: { matchId: string; layoutJson: string }) => void;
	"game:begin": (payload: MatchBegin) => void;
	"game:snapshot": (payload: WorldSnapshot) => void;
	"game:events": (payload: { t: number; events: GameEvent[] }) => void;
	"game:forcedMove": (payload: ForcedMove) => void;
	"game:castResult": (payload: CastResult) => void;
	"game:inventory": (payload: PlayerInventory) => void;
	"game:end": (payload: MatchResults) => void;
	"game:aborted": (payload: { reason: AbortReason }) => void;
}
