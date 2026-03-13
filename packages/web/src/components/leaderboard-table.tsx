'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  player: {
    id: string;
    steamId: string;
    personaName: string;
    avatar: string | null;
  };
  rating: number;
  ratingDeviation: number;
  wins: number;
  losses: number;
  winStreak: number;
  lossStreak: number;
  totalMatches: number;
  winRate: number;
  recentForm: ('W' | 'L')[];
}

export function LeaderboardTable() {
  const { data: leaderboard, isLoading, error } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await api.get('/leaderboard');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-dota-border/30 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !leaderboard) {
    return (
      <div className="text-center py-8 text-dota-text-secondary">
        Failed to load leaderboard
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-8 text-dota-text-secondary">
        No players yet. Be the first to play a match!
      </div>
    );
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getWinRate = (wins: number, losses: number) => {
    const total = wins + losses;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  const getStreakIcon = (streak: number) => {
    if (streak > 0) return <TrendingUp className="w-4 h-4 text-radiant-light" />;
    if (streak < 0) return <TrendingDown className="w-4 h-4 text-dire-light" />;
    return <Minus className="w-4 h-4 text-dota-text-secondary" />;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-dota-text-secondary text-sm border-b border-dota-border">
            <th className="pb-3 pr-4">Rank</th>
            <th className="pb-3 pr-4">Player</th>
            <th className="pb-3 pr-4 text-right">MMR</th>
            <th className="pb-3 pr-4 text-right hidden sm:table-cell">W/L</th>
            <th className="pb-3 text-right hidden sm:table-cell">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry) => (
            <tr
              key={entry.player.id}
              className="border-b border-dota-border/50 hover:bg-dota-border/20 transition-colors"
            >
              <td className="py-3 pr-4">
                <span className={entry.rank <= 3 ? 'text-2xl' : 'text-dota-text-secondary'}>
                  {getRankBadge(entry.rank)}
                </span>
              </td>
              <td className="py-3 pr-4">
                <Link
                  href={`/players/${entry.player.steamId}`}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  {entry.player.avatar ? (
                    <Image
                      src={entry.player.avatar}
                      alt={entry.player.personaName}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-dota-border rounded-full" />
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium">{entry.player.personaName}</span>
                    <span className="text-xs text-dota-text-secondary flex items-center gap-1">
                      {getStreakIcon(entry.winStreak)}
                      {Math.abs(entry.winStreak)} streak
                    </span>
                  </div>
                </Link>
              </td>
              <td className="py-3 pr-4 text-right">
                <span className="font-mono font-bold text-gold">
                  {entry.rating}
                </span>
                <span className="text-xs text-dota-text-secondary ml-1">
                  ±{entry.ratingDeviation}
                </span>
              </td>
              <td className="py-3 pr-4 text-right hidden sm:table-cell">
                <span className="text-radiant-light">{entry.wins}</span>
                <span className="text-dota-text-secondary mx-1">/</span>
                <span className="text-dire-light">{entry.losses}</span>
              </td>
              <td className="py-3 text-right hidden sm:table-cell">
                <span
                  className={
                    entry.winRate >= 50
                      ? 'text-radiant-light'
                      : 'text-dire-light'
                  }
                >
                  {entry.winRate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
