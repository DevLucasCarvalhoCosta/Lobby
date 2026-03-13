import { LeaderboardTable } from '@/components/leaderboard-table';
import { RecentMatches } from '@/components/recent-matches';
import { QuickStats } from '@/components/quick-stats';
import { ReportMatchButton } from '@/components/report-match-button';

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-radiant-light to-gold bg-clip-text text-transparent">
          Dota League
        </h1>
        <p className="text-dota-text-secondary text-lg">
          Track your custom lobby matches and climb the leaderboard
        </p>
        <ReportMatchButton />
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leaderboard */}
        <div className="lg:col-span-2">
          <div className="bg-dota-card border border-dota-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-gold">🏆</span> Leaderboard
            </h2>
            <LeaderboardTable />
          </div>
        </div>

        {/* Recent Matches */}
        <div>
          <div className="bg-dota-card border border-dota-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>⚔️</span> Recent Matches
            </h2>
            <RecentMatches />
          </div>
        </div>
      </div>
    </div>
  );
}
