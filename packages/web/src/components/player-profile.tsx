'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Trophy, Swords, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

interface PlayerDetails {
  id: string;
  steamId: string;
  accountId: number;
  personaName: string;
  avatar: string | null;
  avatarFull: string | null;
  profileUrl: string | null;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  wins: number;
  losses: number;
  winStreak: number;
  lastMatchAt: string | null;
  createdAt: string;
  recentMatches: PlayerMatch[];
  ratingHistory: RatingPoint[];
}

interface PlayerMatch {
  id: string;
  matchId: string;
  radiantWin: boolean;
  duration: number;
  playedAt: string;
  team: 'radiant' | 'dire';
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  ratingChange: number;
}

interface RatingPoint {
  rating: number;
  ratingDeviation: number;
  createdAt: string;
}

interface Props {
  steamId: string;
}

export function PlayerProfile({ steamId }: Props) {
  const { data: player, isLoading, error } = useQuery<PlayerDetails>({
    queryKey: ['player', steamId],
    queryFn: async () => {
      const response = await api.get(`/players/${steamId}`);
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-dota-border/30 rounded-lg animate-pulse" />
        <div className="h-64 bg-dota-border/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="text-center py-16">
        <p className="text-dota-text-secondary">Player not found</p>
        <Link href="/players" className="text-radiant-light hover:underline mt-2 inline-block">
          ← Back to players
        </Link>
      </div>
    );
  }

  const winRate = player.wins + player.losses > 0
    ? Math.round((player.wins / (player.wins + player.losses)) * 100)
    : 0;

  const isWon = (match: PlayerMatch) => {
    return (match.team === 'radiant' && match.radiantWin) ||
           (match.team === 'dire' && !match.radiantWin);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-dota-card border border-dota-border rounded-lg p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {player.avatarFull ? (
            <Image
              src={player.avatarFull}
              alt={player.personaName}
              width={128}
              height={128}
              className="rounded-lg"
            />
          ) : (
            <div className="w-32 h-32 bg-dota-border rounded-lg" />
          )}

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{player.personaName}</h1>
              {player.profileUrl && (
                <a
                  href={player.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dota-text-secondary hover:text-dota-text"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-dota-text-secondary">MMR</span>
                <p className="text-2xl font-bold text-gold">{Math.round(player.rating)}</p>
              </div>
              <div>
                <span className="text-dota-text-secondary">Record</span>
                <p className="text-xl">
                  <span className="text-radiant-light font-semibold">{player.wins}</span>
                  <span className="text-dota-text-secondary mx-1">-</span>
                  <span className="text-dire-light font-semibold">{player.losses}</span>
                </p>
              </div>
              <div>
                <span className="text-dota-text-secondary">Win Rate</span>
                <p className={`text-xl font-semibold ${winRate >= 50 ? 'text-radiant-light' : 'text-dire-light'}`}>
                  {winRate}%
                </p>
              </div>
              <div>
                <span className="text-dota-text-secondary">Streak</span>
                <p className="text-xl flex items-center gap-1">
                  {player.winStreak > 0 ? (
                    <>
                      <TrendingUp className="w-5 h-5 text-radiant-light" />
                      <span className="text-radiant-light font-semibold">{player.winStreak}W</span>
                    </>
                  ) : player.winStreak < 0 ? (
                    <>
                      <TrendingDown className="w-5 h-5 text-dire-light" />
                      <span className="text-dire-light font-semibold">{Math.abs(player.winStreak)}L</span>
                    </>
                  ) : (
                    <span className="text-dota-text-secondary">-</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dota-card border border-dota-border rounded-lg p-4 text-center">
          <Trophy className="w-8 h-8 mx-auto mb-2 text-gold" />
          <p className="text-2xl font-bold">{player.wins}</p>
          <p className="text-sm text-dota-text-secondary">Victories</p>
        </div>
        <div className="bg-dota-card border border-dota-border rounded-lg p-4 text-center">
          <Swords className="w-8 h-8 mx-auto mb-2 text-dire-light" />
          <p className="text-2xl font-bold">{player.wins + player.losses}</p>
          <p className="text-sm text-dota-text-secondary">Total Matches</p>
        </div>
        <div className="bg-dota-card border border-dota-border rounded-lg p-4 text-center">
          <span className="text-2xl">±</span>
          <p className="text-2xl font-bold">{Math.round(player.ratingDeviation)}</p>
          <p className="text-sm text-dota-text-secondary">Rating Deviation</p>
        </div>
        <div className="bg-dota-card border border-dota-border rounded-lg p-4 text-center">
          <span className="text-2xl">📅</span>
          <p className="text-lg font-bold">
            {player.lastMatchAt
              ? formatDistanceToNow(new Date(player.lastMatchAt), { addSuffix: true })
              : 'Never'}
          </p>
          <p className="text-sm text-dota-text-secondary">Last Match</p>
        </div>
      </div>

      {/* Recent Matches */}
      <div className="bg-dota-card border border-dota-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Matches</h2>
        {player.recentMatches && player.recentMatches.length > 0 ? (
          <div className="space-y-3">
            {player.recentMatches.map((match) => {
              const won = isWon(match);
              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.matchId}`}
                  className="flex items-center gap-4 p-3 bg-dota-bg rounded-lg border border-dota-border hover:border-dota-text-secondary transition-colors"
                >
                  <div className={`w-1 h-12 rounded-full ${won ? 'bg-radiant-light' : 'bg-dire-light'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={won ? 'text-radiant-light' : 'text-dire-light'}>
                        {won ? 'Victory' : 'Defeat'}
                      </span>
                      <span className="text-dota-text-secondary text-sm">
                        as {match.team.charAt(0).toUpperCase() + match.team.slice(1)}
                      </span>
                    </div>
                    <div className="text-sm text-dota-text-secondary">
                      {formatDistanceToNow(new Date(match.playedAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono">
                      <span className="text-radiant-light">{match.kills}</span>
                      <span className="text-dota-text-secondary">/</span>
                      <span className="text-dire-light">{match.deaths}</span>
                      <span className="text-dota-text-secondary">/</span>
                      <span className="text-dota-text">{match.assists}</span>
                    </div>
                    <div className="text-xs text-dota-text-secondary">K/D/A</div>
                  </div>
                  <div className={`text-right font-mono ${match.ratingChange >= 0 ? 'text-radiant-light' : 'text-dire-light'}`}>
                    {match.ratingChange >= 0 ? '+' : ''}{Math.round(match.ratingChange)}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-8 text-dota-text-secondary">No matches played yet</p>
        )}
      </div>
    </div>
  );
}
