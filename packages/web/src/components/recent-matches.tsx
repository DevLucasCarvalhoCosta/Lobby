'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

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

interface RecentMatch {
  id: string;
  matchId: string;
  radiantWin: boolean;
  duration: number;
  playedAt: string;
  players: MatchPlayer[];
}

export function RecentMatches() {
  const { data: matches, isLoading, error } = useQuery<RecentMatch[]>({
    queryKey: ['recent-matches'],
    queryFn: async () => {
      const response = await api.get('/matches/recent?limit=5');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-dota-border/30 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !matches) {
    return (
      <div className="text-center py-8 text-dota-text-secondary">
        Failed to load matches
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-dota-text-secondary">
        No matches yet. Report a match to get started!
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {matches.map((match) => {
        const radiantPlayers = match.players.filter((p) => p.team === 'radiant');
        const direPlayers = match.players.filter((p) => p.team === 'dire');

        return (
          <Link
            key={match.id}
            href={`/matches/${match.matchId}`}
            className="block p-4 bg-dota-bg rounded-lg border border-dota-border hover:border-dota-text-secondary transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={match.radiantWin ? 'text-radiant-light font-medium' : 'text-dire-light font-medium'}>
                {match.radiantWin ? 'Radiant Victory' : 'Dire Victory'}
              </span>
              <span className="text-xs text-dota-text-secondary">
                {formatDistanceToNow(new Date(match.playedAt), { addSuffix: true })}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex flex-col">
                <span className="text-radiant-light text-xs mb-1">Radiant</span>
                <span className="text-dota-text truncate max-w-[120px]">
                  {radiantPlayers.map((p) => p.personaName).join(', ')}
                </span>
              </div>
              <div className="text-center px-4">
                <span className="text-dota-text-secondary">{formatDuration(match.duration)}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-dire-light text-xs mb-1">Dire</span>
                <span className="text-dota-text truncate max-w-[120px]">
                  {direPlayers.map((p) => p.personaName).join(', ')}
                </span>
              </div>
            </div>
          </Link>
        );
      })}

      <Link
        href="/matches"
        className="block text-center py-2 text-sm text-dota-text-secondary hover:text-dota-text transition-colors"
      >
        View all matches →
      </Link>
    </div>
  );
}
