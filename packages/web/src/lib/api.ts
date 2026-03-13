import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  withCredentials: true,
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // User is not authenticated
      // Could redirect to login or clear local state
    }
    return Promise.reject(error);
  }
);

// ==================
// Lobby API Functions
// ==================

export interface Lobby {
  id: string;
  dotaLobbyId: string | null;
  name: string;
  password: string;
  serverRegion: number;
  gameMode: number;
  status: string;
  createdAt: string;
  players: LobbyPlayer[];
}

export interface LobbyPlayer {
  id: string;
  steamId: string;
  personaName: string;
  team: 'UNASSIGNED' | 'RADIANT' | 'DIRE' | 'SPECTATOR';
  slot: number | null;
  joined: boolean;
}

export interface CreateLobbyParams {
  name: string;
  password?: string;
  serverRegion?: number;
  gameMode?: number;
  playerSteamIds: string[];
}

export const lobbyApi = {
  // Get all active lobbies
  getActiveLobbies: () => api.get<Lobby[]>('/lobby').then(res => res.data),

  // Get single lobby by ID
  getLobby: (id: string) => api.get<Lobby>(`/lobby/${id}`).then(res => res.data),

  // Get my lobbies
  getMyLobbies: () => api.get<Lobby[]>('/lobby/my/lobbies').then(res => res.data),

  // Create a new lobby
  createLobby: (params: CreateLobbyParams) => 
    api.post<Lobby>('/lobby', params).then(res => res.data),

  // Launch lobby
  launchLobby: (id: string) => 
    api.post(`/lobby/${id}/launch`).then(res => res.data),

  // Cancel lobby
  cancelLobby: (id: string, reason?: string) => 
    api.delete(`/lobby/${id}`, { data: { reason } }).then(res => res.data),

  // Get GC service status
  getGCStatus: () => 
    api.get('/lobby/gc/status').then(res => res.data),
};

// Server region names
export const SERVER_REGIONS: Record<number, string> = {
  1: 'US West',
  2: 'US East',
  3: 'Europe',
  4: 'Korea',
  5: 'Singapore',
  6: 'Dubai',
  7: 'Australia',
  8: 'Stockholm',
  9: 'Austria',
  10: 'Brazil',
  11: 'South Africa',
  14: 'Chile',
  15: 'Peru',
  16: 'India',
  19: 'Japan',
};

// Game mode names
export const GAME_MODES: Record<number, string> = {
  1: 'All Pick',
  2: "Captain's Mode",
  3: 'Random Draft',
  4: 'Single Draft',
  5: 'All Random',
};

// Lobby status display names
export const LOBBY_STATUS: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'Created', color: 'gray' },
  INVITES_SENT: { label: 'Invites Sent', color: 'blue' },
  PLAYERS_JOINING: { label: 'Players Joining', color: 'yellow' },
  READY: { label: 'Ready', color: 'green' },
  LAUNCHING: { label: 'Launching...', color: 'purple' },
  IN_GAME: { label: 'In Game', color: 'orange' },
  FINISHED: { label: 'Finished', color: 'gray' },
  CANCELLED: { label: 'Cancelled', color: 'red' },
  FAILED: { label: 'Failed', color: 'red' },
};
