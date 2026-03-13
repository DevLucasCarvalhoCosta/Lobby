'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { ExternalLink, Clock, Users } from 'lucide-react';

interface MatchPlayer {
  id: string;
  steamId: string;
  personaName: string;
  avatar: string | null;
  team: 'radiant' | 'dire';
  hero: string;
  heroId: number;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  goldPerMin: number;
  xpPerMin: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  ratingBefore: number;
  ratingAfter: number;
}

interface MatchDetails {
  id: string;
  matchId: string;
  radiantWin: boolean;
  duration: number;
  firstBloodTime: number;
  radiantScore: number;
  direScore: number;
  playedAt: string;
  registeredAt: string;
  players: MatchPlayer[];
}

interface Props {
  matchId: string;
}

export function MatchDetails({ matchId }: Props) {
  const { data: match, isLoading, error } = useQuery<MatchDetails>({
    queryKey: ['match', matchId],
    queryFn: async () => {
      const response = await api.get(`/matches/${matchId}`);
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-dota-border/30 rounded-lg animate-pulse" />
        <div className="h-96 bg-dota-border/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="text-center py-16">
        <p className="text-dota-text-secondary">Match not found</p>
        <Link href="/matches" className="text-radiant-light hover:underline mt-2 inline-block">
          ← Back to matches
        </Link>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const radiantPlayers = match.players.filter((p) => p.team === 'radiant');
  const direPlayers = match.players.filter((p) => p.team === 'dire');

  const PlayerRow = ({ player, isRadiant }: { player: MatchPlayer; isRadiant: boolean }) => {
    const ratingChange = player.ratingAfter - player.ratingBefore;
    const kda = player.deaths === 0 
      ? (player.kills + player.assists).toFixed(1)
      : ((player.kills + player.assists) / player.deaths).toFixed(1);

    return (
      <tr className="border-b border-dota-border/50 hover:bg-dota-border/20">
        <td className="py-3 pr-4">
          <Link
            href={`/players/${player.steamId}`}
            className="flex items-center gap-3 hover:opacity-80"
          >
            {player.avatar ? (
              <Image
                src={player.avatar}
                alt={player.personaName}
                width={36}
                height={36}
                className="rounded-full"
              />
            ) : (
              <div className="w-9 h-9 bg-dota-border rounded-full" />
            )}
            <span className="font-medium">{player.personaName}</span>
          </Link>
        </td>
        <td className="py-3 pr-4 text-center font-mono">
          <span className="text-radiant-light">{player.kills}</span>
          <span className="text-dota-text-secondary">/</span>
          <span className="text-dire-light">{player.deaths}</span>
          <span className="text-dota-text-secondary">/</span>
          <span>{player.assists}</span>
        </td>
        <td className="py-3 pr-4 text-center text-dota-text-secondary">{kda}</td>
        <td className="py-3 pr-4 text-center hidden md:table-cell">
          <span className="text-dota-text-secondary">{player.lastHits}</span>
          <span className="text-dota-border mx-1">/</span>
          <span className="text-dota-text-secondary">{player.denies}</span>
        </td>
        <td className="py-3 pr-4 text-center hidden md:table-cell text-gold">{player.goldPerMin}</td>
        <td className="py-3 pr-4 text-center hidden lg:table-cell">{player.heroDamage.toLocaleString()}</td>
        <td className="py-3 text-right">
          <span className={ratingChange >= 0 ? 'text-radiant-light' : 'text-dire-light'}>
            {ratingChange >= 0 ? '+' : ''}{Math.round(ratingChange)}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Match Header */}
      <div className="bg-dota-card border border-dota-border rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">Match {match.matchId}</h1>
              <a
                href={`https://www.opendota.com/matches/${match.matchId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-dota-text-secondary hover:text-dota-text"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
            <p className={`text-xl font-semibold ${match.radiantWin ? 'text-radiant-light' : 'text-dire-light'}`}>
              {match.radiantWin ? 'Radiant Victory' : 'Dire Victory'}
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 text-dota-text-secondary">
              <Clock className="w-4 h-4" />
              {formatDuration(match.duration)}
            </div>
            <div className="flex items-center gap-2 text-dota-text-secondary">
              <Users className="w-4 h-4" />
              {match.players.length} players
            </div>
            <div className="text-dota-text-secondary">
              {format(new Date(match.playedAt), 'MMM d, yyyy h:mm a')}
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="mt-6 flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-4xl font-bold text-radiant-light">{match.radiantScore}</p>
            <p className="text-sm text-dota-text-secondary">Radiant</p>
          </div>
          <div className="text-2xl text-dota-text-secondary">vs</div>
          <div className="text-center">
            <p className="text-4xl font-bold text-dire-light">{match.direScore}</p>
            <p className="text-sm text-dota-text-secondary">Dire</p>
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radiant */}
        <div className="bg-dota-card border border-dota-border rounded-lg p-6">
          <h2 className={`text-xl font-semibold mb-4 ${match.radiantWin ? 'text-radiant-light' : 'text-dota-text'}`}>
            Radiant {match.radiantWin && '👑'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-dota-text-secondary border-b border-dota-border">
                  <th className="pb-2 text-left">Player</th>
                  <th className="pb-2">K/D/A</th>
                  <th className="pb-2">KDA</th>
                  <th className="pb-2 hidden md:table-cell">LH/DN</th>
                  <th className="pb-2 hidden md:table-cell">GPM</th>
                  <th className="pb-2 hidden lg:table-cell">DMG</th>
                  <th className="pb-2 text-right">MMR</th>
                </tr>
              </thead>
              <tbody>
                {radiantPlayers.map((player) => (
                  <PlayerRow key={player.id} player={player} isRadiant={true} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dire */}
        <div className="bg-dota-card border border-dota-border rounded-lg p-6">
          <h2 className={`text-xl font-semibold mb-4 ${!match.radiantWin ? 'text-dire-light' : 'text-dota-text'}`}>
            Dire {!match.radiantWin && '👑'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-dota-text-secondary border-b border-dota-border">
                  <th className="pb-2 text-left">Player</th>
                  <th className="pb-2">K/D/A</th>
                  <th className="pb-2">KDA</th>
                  <th className="pb-2 hidden md:table-cell">LH/DN</th>
                  <th className="pb-2 hidden md:table-cell">GPM</th>
                  <th className="pb-2 hidden lg:table-cell">DMG</th>
                  <th className="pb-2 text-right">MMR</th>
                </tr>
              </thead>
              <tbody>
                {direPlayers.map((player) => (
                  <PlayerRow key={player.id} player={player} isRadiant={false} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="text-center">
        <Link href="/matches" className="text-dota-text-secondary hover:text-dota-text">
          ← Back to matches
        </Link>
      </div>
    </div>
  );
}
