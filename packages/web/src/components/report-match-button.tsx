'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Loader2, Check, AlertCircle } from 'lucide-react';

interface MatchCandidate {
  matchId: string;
  playedAt: string;
  duration: number;
  radiantWin: boolean;
  leagueMemberCount: number;
  totalPlayers: number;
}

export function ReportMatchButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [manualMatchId, setManualMatchId] = useState('');
  const queryClient = useQueryClient();

  const { data: candidates, isLoading: loadingCandidates, refetch } = useQuery<MatchCandidate[]>({
    queryKey: ['match-candidates', user?.accountId],
    queryFn: async () => {
      if (!user?.accountId) return [];
      const response = await api.get(`/matches/detect?accountId=${user.accountId}`);
      return response.data.candidates;
    },
    enabled: isOpen && !!user?.accountId,
  });

  const registerMutation = useMutation({
    mutationFn: async (matchId: string) => {
      await api.post('/matches/register', { matchId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-matches'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['quick-stats'] });
      setIsOpen(false);
      setManualMatchId('');
    },
  });

  if (!user) {
    return (
      <button
        onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/steam`}
        className="px-6 py-3 bg-gradient-to-r from-radiant to-radiant-light text-black font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
      >
        <Plus className="w-5 h-5" />
        Login to Report Match
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          refetch();
        }}
        className="px-6 py-3 bg-gradient-to-r from-radiant to-radiant-light text-black font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
      >
        <Plus className="w-5 h-5" />
        Report Match
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dota-card border border-dota-border rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-dota-border">
              <h2 className="text-xl font-semibold">Report Match</h2>
              <p className="text-sm text-dota-text-secondary mt-1">
                Select a recent custom lobby match or enter a match ID manually
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Auto-detected matches */}
              <div>
                <h3 className="text-sm font-medium text-dota-text-secondary mb-3">
                  Recent Custom Lobbies
                </h3>
                {loadingCandidates ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-dota-text-secondary" />
                  </div>
                ) : candidates && candidates.length > 0 ? (
                  <div className="space-y-2">
                    {candidates.map((match) => (
                      <button
                        key={match.matchId}
                        onClick={() => registerMutation.mutate(match.matchId)}
                        disabled={registerMutation.isPending}
                        className="w-full p-4 bg-dota-bg rounded-lg border border-dota-border hover:border-radiant transition-colors text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{match.matchId}</span>
                          <span className={match.radiantWin ? 'text-radiant-light' : 'text-dire-light'}>
                            {match.radiantWin ? 'Radiant Win' : 'Dire Win'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-sm text-dota-text-secondary">
                          <span>{new Date(match.playedAt).toLocaleString()}</span>
                          <span>{match.leagueMemberCount}/{match.totalPlayers} league members</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-dota-text-secondary">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No recent custom lobby matches found</p>
                    <p className="text-xs mt-1">Enter a match ID manually below</p>
                  </div>
                )}
              </div>

              {/* Manual entry */}
              <div>
                <h3 className="text-sm font-medium text-dota-text-secondary mb-3">
                  Manual Entry
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualMatchId}
                    onChange={(e) => setManualMatchId(e.target.value)}
                    placeholder="Enter match ID (e.g., 7654321234)"
                    className="flex-1 px-4 py-2 bg-dota-bg border border-dota-border rounded-lg focus:outline-none focus:border-radiant"
                  />
                  <button
                    onClick={() => registerMutation.mutate(manualMatchId)}
                    disabled={!manualMatchId || registerMutation.isPending}
                    className="px-4 py-2 bg-radiant text-black font-medium rounded-lg disabled:opacity-50 hover:bg-radiant-light transition-colors"
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-dota-text-secondary mt-2">
                  Find the match ID on OpenDota or Dotabuff URL
                </p>
              </div>

              {registerMutation.isError && (
                <div className="p-4 bg-dire/20 border border-dire rounded-lg text-sm text-dire-light">
                  Failed to register match. Please try again.
                </div>
              )}
            </div>

            <div className="p-6 border-t border-dota-border flex justify-end">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setManualMatchId('');
                }}
                className="px-4 py-2 text-dota-text-secondary hover:text-dota-text transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
