import { MatchesList } from '@/components/matches-list';

export default function MatchesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Match History</h1>
        <p className="text-dota-text-secondary mt-1">
          All recorded league matches
        </p>
      </div>

      <div className="bg-dota-card border border-dota-border rounded-lg p-6">
        <MatchesList />
      </div>
    </div>
  );
}
