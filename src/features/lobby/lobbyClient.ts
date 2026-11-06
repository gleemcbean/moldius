import type { HatPattern } from '@shared/hatPatterns';
import type { MatchConfig } from '@shared/matchConfig';
import type { LobbyError, LobbyState } from '@shared/protocol/lobby';
import { navigate, showToast } from '../../app/appStore';
import { currentMessages } from '../../i18n';
import { getSocket } from '../network/socket';
import { createStore } from '../../utils/store';
import { micManager } from '../voice/micManager';
import { settingsStore } from '../settings/settingsStore';
import { lobbyStore } from './lobbyStore';

type LobbyResponse = { ok: true; value: LobbyState } | { ok: false; error: LobbyError };

let listening = false;

export function listenLobbyUpdates(): void {
  if (listening) {
    return;
  }
  listening = true;
  const socket = getSocket();
  socket.on('lobby:state', (state) => {
    const current = lobbyStore.get().lobby;
    if (current && current.id !== state.id) {
      return;
    }
    lobbyStore.set({ lobby: state });
  });
}

function lobbyErrorText(error: LobbyError): string {
  return currentMessages().lobby.errors[error.code] ?? error.message;
}

function handleJoin(response: LobbyResponse): boolean {
  lobbyStore.set({ pending: false });
  if (!response.ok) {
    const message = lobbyErrorText(response.error);
    lobbyStore.set({ error: message });
    showToast(message, 'error');
    return false;
  }
  lobbyStore.set({ lobby: response.value, error: null });
  navigate('lobby');
  return true;
}

function appearance(): { color: number; pattern: HatPattern } {
  const settings = settingsStore.get();
  return { color: settings.playerColor, pattern: settings.playerPattern };
}

export function quickJoin(name: string): void {
  lobbyStore.set({ pending: true, error: null, lobby: null });
  getSocket().emit('lobby:quickJoin', { name, ...appearance() }, handleJoin);
}

export function createPrivateLobby(name: string): void {
  lobbyStore.set({ pending: true, error: null, lobby: null });
  getSocket().emit('lobby:createPrivate', { name, ...appearance() }, handleJoin);
}

export function startTutorial(name: string): void {
  lobbyStore.set({ pending: true, error: null, lobby: null });
  void micManager.acquire(settingsStore.get().micDeviceId);
  getSocket().emit('lobby:startTutorial', { name }, (response: LobbyResponse) => {
    lobbyStore.set({ pending: false });
    if (response.ok) {
      lobbyStore.set({ lobby: response.value, error: null });
    } else {
      showToast(lobbyErrorText(response.error), 'error');
    }
  });
}

export function joinPrivateLobby(name: string, code: string): void {
  lobbyStore.set({ pending: true, error: null, lobby: null });
  getSocket().emit('lobby:joinPrivate', { name, code, ...appearance() }, handleJoin);
}

export function joinPublicLobby(name: string, lobbyId: string): void {
  lobbyStore.set({ pending: true, error: null, lobby: null });
  getSocket().emit('lobby:joinPublic', { name, lobbyId, ...appearance() }, handleJoin);
}

export function leaveLobby(): void {
  getSocket().emit('lobby:leave');
  lobbyStore.set({ lobby: null });
  navigate('home');
}

export function setReady(ready: boolean): void {
  getSocket().emit('lobby:ready', { ready });
}

export function chooseTeam(team: number): void {
  getSocket().emit('lobby:team', { team });
}

export function reportMicrophone(ready: boolean): void {
  getSocket().emit('lobby:microphone', { ready });
}

const CONFIG_INTERVAL_MS = 250;
let pendingConfig: MatchConfig | null = null;
let configTimer: number | null = null;
let lastConfigAt = 0;

export const configDraftStore = createStore<{ config: MatchConfig | null }>({
  config: null,
});

export function updateLobbyConfig(config: MatchConfig): void {
  pendingConfig = config;
  configDraftStore.set({ config });
  if (configTimer !== null) {
    return;
  }
  const wait = Math.max(0, lastConfigAt + CONFIG_INTERVAL_MS - Date.now());
  configTimer = window.setTimeout(flushLobbyConfig, wait);
}

function flushLobbyConfig(): void {
  configTimer = null;
  const config = pendingConfig;
  pendingConfig = null;
  if (!config) {
    return;
  }
  lastConfigAt = Date.now();
  getSocket().emit('lobby:config', { config }, (response) => {
    if (pendingConfig === null && configTimer === null) {
      configDraftStore.set({ config: null });
    }
    if (!response.ok) {
      showToast(lobbyErrorText(response.error), 'error');
    }
  });
}

export function startMatch(): void {
  getSocket().emit('lobby:start', (response) => {
    if (!response.ok) {
      showToast(lobbyErrorText(response.error), 'error');
    }
  });
}
