'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Users, Swords, Trophy, TrendingUp } from 'lucide-react';

interface Stats {
  totalPlayers: number;
  totalMatches: number;
  matchesThisWeek: number;
  avgRating: number;
}

export function QuickStats() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['quick-stats'],
    queryFn: async () => {
      const response = await api.get('/leaderboard/stats');
      return response.data;
    },
  });

  const statItems = [
    {
      label: 'Players',
      value: stats?.totalPlayers ?? 0,
      icon: Users,
      color: 'text-radiant-light',
    },
    {
      label: 'Total Matches',
      value: stats?.totalMatches ?? 0,
      icon: Swords,
      color: 'text-gold',
    },
    {
      label: 'This Week',
      value: stats?.matchesThisWeek ?? 0,
      icon: Trophy,
      color: 'text-dire-light',
    },
    {
      label: 'Avg MMR',
      value: Math.round(stats?.avgRating ?? 1500),
      icon: TrendingUp,
      color: 'text-dota-text',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="bg-dota-card border border-dota-border rounded-lg p-4 flex items-center gap-4"
        >
          <div className={`p-3 rounded-lg bg-dota-bg ${item.color}`}>
            <item.icon className="w-6 h-6" />
          </div>
          <div>
            {isLoading ? (
              <div className="h-8 w-16 bg-dota-border rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold">{item.value}</p>
            )}
            <p className="text-sm text-dota-text-secondary">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
