'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { lobbyApi, Lobby, LobbyPlayer, LOBBY_STATUS, SERVER_REGIONS, GAME_MODES } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function PlayerSlot({ player, team }: { player?: LobbyPlayer; team: 'RADIANT' | 'DIRE'; slot: number }) {
  const teamColor = team === 'RADIANT' ? 'green' : 'red';

  if (!player) {
    return (
      <div className={`p-3 rounded-lg border border-dashed border-gray-700 text-gray-500 text-center`}>
        Empty Slot
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg bg-${teamColor}-900/20 border border-${teamColor}-800 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm">
          {player.personaName.charAt(0).toUpperCase()}
        </div>
        <span className="text-white font-medium">{player.personaName}</span>
      </div>
      <div className="flex items-center gap-2">
        {player.joined ? (
          <span className="text-green-400 text-sm flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full" />
            Joined
          </span>
        ) : (
          <span className="text-yellow-400 text-sm flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            Invited
          </span>
        )}
      </div>
    </div>
  );
}

function TeamPanel({ team, players }: { team: 'RADIANT' | 'DIRE'; players: LobbyPlayer[] }) {
  const teamColor = team === 'RADIANT' ? 'green' : 'red';
  const teamPlayers = players.filter(p => p.team === team).sort((a, b) => (a.slot || 0) - (b.slot || 0));
  const joinedCount = teamPlayers.filter(p => p.joined).length;

  return (
    <div className="flex-1">
      <div className={`flex items-center justify-between mb-3 pb-2 border-b border-${teamColor}-800`}>
        <h3 className={`font-bold text-${teamColor}-500 text-lg`}>{team}</h3>
        <span className="text-gray-400 text-sm">{joinedCount}/5 joined</span>
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map(slot => (
          <PlayerSlot
            key={slot}
            player={teamPlayers.find(p => p.slot === slot) || teamPlayers[slot]}
            team={team}
            slot={slot}
          />
        ))}
      </div>
    </div>
  );
}

export default function LobbyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const lobbyId = params.id as string;

  const { data: lobby, isLoading, error } = useQuery({
    queryKey: ['lobby', lobbyId],
    queryFn: () => lobbyApi.getLobby(lobbyId),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling if lobby is finished/cancelled/failed
      if (data && ['FINISHED', 'CANCELLED', 'FAILED'].includes(data.status)) {
        return false;
      }
      return 2000; // Poll every 2 seconds for active lobbies
    },
  });

  const launchMutation = useMutation({
    mutationFn: () => lobbyApi.launchLobby(lobbyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lobby', lobbyId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => lobbyApi.cancelLobby(lobbyId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lobby', lobbyId] });
      queryClient.invalidateQueries({ queryKey: ['lobbies'] });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-800 rounded w-1/4 mb-8" />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-lg h-96" />
            <div className="bg-gray-800 rounded-lg h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !lobby) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Lobby Not Found</h2>
          <p className="text-gray-400 mb-4">
            This lobby may have been deleted or does not exist.
          </p>
          <Link href="/lobby">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
              Back to Lobbies
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const status = LOBBY_STATUS[lobby.status] || { label: lobby.status, color: 'gray' };
  const region = SERVER_REGIONS[lobby.serverRegion] || `Region ${lobby.serverRegion}`;
  const mode = GAME_MODES[lobby.gameMode] || `Mode ${lobby.gameMode}`;
  
  const allPlayersJoined = lobby.players.every(p => p.joined);
  const canLaunch = lobby.status === 'READY' || (lobby.status === 'PLAYERS_JOINING' && allPlayersJoined);
  const canCancel = !['FINISHED', 'CANCELLED', 'FAILED', 'IN_GAME'].includes(lobby.status);
  const isActive = !['FINISHED', 'CANCELLED', 'FAILED'].includes(lobby.status);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/lobby" className="text-gray-400 hover:text-white text-sm">
          ← Back to Lobbies
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            {lobby.name}
            <span className={`px-3 py-1 rounded text-sm font-medium bg-${status.color}-900/50 text-${status.color}-400`}>
              {status.label}
            </span>
          </h1>
          <p className="text-gray-400 mt-1">{region} • {mode}</p>
        </div>

        {user && canCancel && (
          <div className="flex gap-3">
            {canLaunch && (
              <button
                onClick={() => launchMutation.mutate()}
                disabled={launchMutation.isPending}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {launchMutation.isPending ? 'Launching...' : 'Launch Game'}
              </button>
            )}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to cancel this lobby?')) {
                  cancelMutation.mutate('Cancelled by organizer');
                }
              }}
              disabled={cancelMutation.isPending}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
            </button>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {isActive && (
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-6">
          {lobby.status === 'CREATED' && (
            <p className="text-blue-400">Lobby created. Sending invites to players...</p>
          )}
          {lobby.status === 'INVITES_SENT' && (
            <p className="text-blue-400">Invites sent! Waiting for players to join the lobby in Dota 2.</p>
          )}
          {lobby.status === 'PLAYERS_JOINING' && (
            <p className="text-yellow-400">
              Players are joining... {lobby.players.filter(p => p.joined).length}/{lobby.players.length} in lobby.
              {allPlayersJoined && ' All players joined! Ready to launch.'}
            </p>
          )}
          {lobby.status === 'READY' && (
            <p className="text-green-400">All players ready! Click "Launch Game" to start the match.</p>
          )}
          {lobby.status === 'LAUNCHING' && (
            <p className="text-purple-400">Launching game... Please wait.</p>
          )}
          {lobby.status === 'IN_GAME' && (
            <p className="text-orange-400">Match is in progress!</p>
          )}
        </div>
      )}

      {/* Lobby Info */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Lobby ID:</span>
            <p className="text-white font-mono">{lobby.dotaLobbyId || 'Pending...'}</p>
          </div>
          <div>
            <span className="text-gray-400">Password:</span>
            <p className="text-white font-mono">{lobby.password}</p>
          </div>
          <div>
            <span className="text-gray-400">Created:</span>
            <p className="text-white">{new Date(lobby.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-gray-400">Players:</span>
            <p className="text-white">{lobby.players.filter(p => p.joined).length}/{lobby.players.length} joined</p>
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="grid md:grid-cols-2 gap-6">
        <TeamPanel team="RADIANT" players={lobby.players} />
        <TeamPanel team="DIRE" players={lobby.players} />
      </div>

      {/* Match Link */}
      {lobby.status === 'FINISHED' && (
        <div className="mt-6 bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 mb-2">Match completed!</p>
          <Link href={`/matches/${lobby.id}`}>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
              View Match Results
            </button>
          </Link>
        </div>
      )}

      {/* Mutation Errors */}
      {(launchMutation.error || cancelMutation.error) && (
        <div className="mt-4 bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-500">
            {(launchMutation.error as Error)?.message || 
             (cancelMutation.error as Error)?.message || 
             'An error occurred'}
          </p>
        </div>
      )}
    </div>
  );
}
