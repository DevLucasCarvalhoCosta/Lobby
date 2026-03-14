'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { lobbyApi, SERVER_REGIONS, GAME_MODES, CreateLobbyParams } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface PlayerOption {
  steamId: string;
  personaName: string;
  avatar?: string;
}

export default function CreateLobbyPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [serverRegion, setServerRegion] = useState(3); // Default: Europe
  const [gameMode, setGameMode] = useState(2); // Default: Captain's Mode
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerOption[]>([]);

  // Search players query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['player-search', playerSearch],
    queryFn: async () => {
      if (!playerSearch || playerSearch.length < 2) return [];
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/players/search?q=${encodeURIComponent(playerSearch)}`, {
        credentials: 'include',
      });
      return res.json() as Promise<PlayerOption[]>;
    },
    enabled: playerSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (params: CreateLobbyParams) => lobbyApi.createLobby(params),
    onSuccess: (lobby) => {
      router.push(`/lobby/${lobby.id}`);
    },
  });

  const handleAddPlayer = (player: PlayerOption) => {
    if (selectedPlayers.length >= 10) return;
    if (selectedPlayers.some(p => p.steamId === player.steamId)) return;
    setSelectedPlayers([...selectedPlayers, player]);
    setPlayerSearch('');
  };

  const handleRemovePlayer = (steamId: string) => {
    setSelectedPlayers(selectedPlayers.filter(p => p.steamId !== steamId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (selectedPlayers.length < 1) return;

    createMutation.mutate({
      name: name.trim(),
      password: password || undefined,
      serverRegion,
      gameMode,
      playerSteamIds: selectedPlayers.map(p => p.steamId),
    });
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6 text-center">
          <h1 className="text-xl font-bold text-white mb-4">Authentication Required</h1>
          <p className="text-gray-400 mb-4">
            You must be signed in to create a lobby.
          </p>
          <Link href="/api/auth/steam">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
              Sign in with Steam
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/lobby" className="text-gray-400 hover:text-white text-sm">
            ← Back to Lobbies
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-6">Create Lobby</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Lobby Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Lobby Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Friend League Match #42"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Lobby Password
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty for random password"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Server Region */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Server Region
            </label>
            <select
              value={serverRegion}
              onChange={(e) => setServerRegion(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              {Object.entries(SERVER_REGIONS).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Game Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Game Mode
            </label>
            <select
              value={gameMode}
              onChange={(e) => setGameMode(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              {Object.entries(GAME_MODES).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Player Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Players ({selectedPlayers.length}/10) *
            </label>
            
            {/* Search Input */}
            <div className="relative mb-3">
              <input
                type="text"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="Search players by name or Steam ID..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              
              {/* Search Results Dropdown */}
              {playerSearch.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {isSearching && (
                    <div className="p-3 text-gray-400 text-sm">Searching...</div>
                  )}
                  {searchResults && searchResults.length === 0 && (
                    <div className="p-3 text-gray-400 text-sm">No players found</div>
                  )}
                  {searchResults?.map(player => (
                    <button
                      key={player.steamId}
                      type="button"
                      onClick={() => handleAddPlayer(player)}
                      disabled={selectedPlayers.some(p => p.steamId === player.steamId)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                    >
                      {player.avatar && (
                        <img src={player.avatar} alt="" className="w-8 h-8 rounded" />
                      )}
                      <div>
                        <div className="text-white">{player.personaName}</div>
                        <div className="text-gray-500 text-xs">{player.steamId}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Players */}
            <div className="grid grid-cols-2 gap-2">
              {selectedPlayers.map((player, index) => (
                <div
                  key={player.steamId}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    index < 5 ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-500 text-xs w-4">{index + 1}</span>
                    <span className="text-white truncate">{player.personaName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePlayer(player.steamId)}
                    className="text-gray-400 hover:text-red-400 p-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {selectedPlayers.length > 0 && selectedPlayers.length < 10 && (
              <p className="text-gray-400 text-sm mt-2">
                {`${selectedPlayers.length} players selected (10 for full match)`}
              </p>
            )}
          </div>

          {/* Team Assignment Info */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-white mb-2">Team Assignment</h3>
            <p className="text-gray-400 text-sm">
              Players 1-5 will be assigned to <span className="text-green-500">Radiant</span>,
              players 6-10 will be assigned to <span className="text-red-500">Dire</span>.
              You can reorder players by dragging or adjust teams in the lobby page.
            </p>
            <p className="text-blue-400 text-xs mt-2">
              Dev mode: Minimum 1 player to create and launch.
            </p>
          </div>

          {/* Error */}
          {createMutation.error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="text-red-500">
                {(createMutation.error as Error).message || 'Failed to create lobby'}
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={!name.trim() || selectedPlayers.length < 1 || createMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Lobby'}
            </button>
            <Link href="/lobby">
              <button
                type="button"
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
