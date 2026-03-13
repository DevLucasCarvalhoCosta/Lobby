'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { lobbyApi, Lobby, LOBBY_STATUS, SERVER_REGIONS, GAME_MODES } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function LobbyCard({ lobby }: { lobby: Lobby }) {
  const status = LOBBY_STATUS[lobby.status] || { label: lobby.status, color: 'gray' };
  const region = SERVER_REGIONS[lobby.serverRegion] || `Region ${lobby.serverRegion}`;
  const mode = GAME_MODES[lobby.gameMode] || `Mode ${lobby.gameMode}`;

  const radiantPlayers = lobby.players.filter(p => p.team === 'RADIANT');
  const direPlayers = lobby.players.filter(p => p.team === 'DIRE');
  const joinedCount = lobby.players.filter(p => p.joined).length;

  return (
    <Link href={`/lobby/${lobby.id}`}>
      <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer border border-gray-700 hover:border-gray-600">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-lg text-white">{lobby.name}</h3>
            <p className="text-sm text-gray-400">{region} • {mode}</p>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium bg-${status.color}-900/50 text-${status.color}-400`}>
            {status.label}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <div className="flex gap-4">
            <div>
              <span className="text-green-500">Radiant:</span>{' '}
              <span className="text-white">{radiantPlayers.length}/5</span>
            </div>
            <div>
              <span className="text-red-500">Dire:</span>{' '}
              <span className="text-white">{direPlayers.length}/5</span>
            </div>
          </div>
          <div className="text-gray-400">
            {joinedCount}/{lobby.players.length} joined
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LobbyListPage() {
  const { user } = useAuth();

  const { data: lobbies, isLoading, error } = useQuery({
    queryKey: ['lobbies'],
    queryFn: lobbyApi.getActiveLobbies,
    refetchInterval: 5000, // Poll every 5 seconds for lobby updates
  });

  const { data: gcStatus } = useQuery({
    queryKey: ['gc-status'],
    queryFn: lobbyApi.getGCStatus,
    refetchInterval: 30000,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lobbies</h1>
          <p className="text-gray-400 text-sm mt-1">
            Active Dota 2 lobbies in the league
          </p>
        </div>

        <div className="flex items-center gap-4">
          {gcStatus && (
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${gcStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-400">
                GC: {gcStatus.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          )}

          {user && (
            <Link href="/lobby/create">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                Create Lobby
              </button>
            </Link>
          )}
        </div>
      </div>

      {!user && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-yellow-500">
            <Link href="/api/auth/steam" className="underline hover:no-underline">
              Sign in with Steam
            </Link>{' '}
            to create and join lobbies.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-6 bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-700 rounded w-1/2 mb-4" />
              <div className="h-4 bg-gray-700 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-500">Failed to load lobbies. Please try again.</p>
        </div>
      )}

      {lobbies && lobbies.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No active lobbies</p>
          {user && (
            <Link href="/lobby/create">
              <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Create the first lobby
              </button>
            </Link>
          )}
        </div>
      )}

      {lobbies && lobbies.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lobbies.map(lobby => (
            <LobbyCard key={lobby.id} lobby={lobby} />
          ))}
        </div>
      )}
    </div>
  );
}
