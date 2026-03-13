'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

interface Player {
  id: string;
  steamId: string;
  personaName: string;
  avatar: string | null;
  rating: number;
  ratingDeviation: number;
  wins: number;
  losses: number;
  winStreak: number;
  lastMatchAt: string | null;
}

export function PlayersList() {
  const { data: players, isLoading, error } = useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: async () => {
      const response = await api.get('/players');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-dota-border/30 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !players) {
    return (
      <div className="text-center py-8 text-dota-text-secondary">
        Failed to load players
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-dota-text-secondary">
        No players registered yet
      </div>
    );
  }

  const getWinRate = (wins: number, losses: number) => {
    const total = wins + losses;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {players.map((player) => (
        <Link
          key={player.id}
          href={`/players/${player.steamId}`}
          className="p-4 bg-dota-bg rounded-lg border border-dota-border hover:border-radiant transition-colors"
        >
          <div className="flex items-center gap-4">
            {player.avatar ? (
              <Image
                src={player.avatar}
                alt={player.personaName}
                width={48}
                height={48}
                className="rounded-full"
              />
            ) : (
              <div className="w-12 h-12 bg-dota-border rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{player.personaName}</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gold font-mono">{Math.round(player.rating)}</span>
                <span className="text-dota-text-secondary">MMR</span>
              </div>
            </div>
            <div className="text-right text-sm">
              <div>
                <span className="text-radiant-light">{player.wins}</span>
                <span className="text-dota-text-secondary">-</span>
                <span className="text-dire-light">{player.losses}</span>
              </div>
              <div className="text-dota-text-secondary">
                {getWinRate(player.wins, player.losses)}% WR
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
