import { PlayersList } from '@/components/players-list';

export default function PlayersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Players</h1>
        <p className="text-dota-text-secondary mt-1">
          All registered players in the league
        </p>
      </div>

      <div className="bg-dota-card border border-dota-border rounded-lg p-6">
        <PlayersList />
      </div>
    </div>
  );
}
