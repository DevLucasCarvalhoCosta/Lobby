'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';

interface MatchPlayer {
  id: string;
  steamId: string;
  personaName: string;
  team: 'radiant' | 'dire';
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
}

interface Match {
  id: string;
  matchId: string;
  radiantWin: boolean;
  duration: number;
  playedAt: string;
  players: MatchPlayer[];
}

export function MatchesList() {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, error } = useQuery<{ matches: Match[]; total: number }>({
    queryKey: ['matches', page],
    queryFn: async () => {
      const response = await api.get(`/matches?skip=${page * limit}&limit=${limit}`);
      return response.data;
    },
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-dota-border/30 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-dota-text-secondary">
        Failed to load matches
      </div>
    );
  }

  if (data.matches.length === 0) {
    return (
      <div className="text-center py-8 text-dota-text-secondary">
        No matches recorded yet
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {data.matches.map((match) => {
          const radiantPlayers = match.players.filter((p) => p.team === 'radiant');
          const direPlayers = match.players.filter((p) => p.team === 'dire');

          return (
            <Link
              key={match.id}
              href={`/matches/${match.matchId}`}
              className="block p-4 bg-dota-bg rounded-lg border border-dota-border hover:border-dota-text-secondary transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-dota-text-secondary">
                    #{match.matchId}
                  </span>
                  <span className={match.radiantWin ? 'text-radiant-light font-medium' : 'text-dire-light font-medium'}>
                    {match.radiantWin ? 'Radiant' : 'Dire'} Victory
                  </span>
                </div>
                <div className="text-sm text-dota-text-secondary">
                  {formatDistanceToNow(new Date(match.playedAt), { addSuffix: true })}
                  <span className="mx-2">•</span>
                  {formatDuration(match.duration)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-radiant-light font-medium">Radiant</div>
                  {radiantPlayers.map((player) => (
                    <div key={player.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{player.personaName}</span>
                      <span className="font-mono text-dota-text-secondary">
                        {player.kills}/{player.deaths}/{player.assists}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-dire-light font-medium">Dire</div>
                  {direPlayers.map((player) => (
                    <div key={player.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{player.personaName}</span>
                      <span className="font-mono text-dota-text-secondary">
                        {player.kills}/{player.deaths}/{player.assists}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-dota-bg border border-dota-border rounded-lg disabled:opacity-50 hover:border-dota-text-secondary transition-colors"
          >
            Previous
          </button>
          <span className="text-dota-text-secondary">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 bg-dota-bg border border-dota-border rounded-lg disabled:opacity-50 hover:border-dota-text-secondary transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
