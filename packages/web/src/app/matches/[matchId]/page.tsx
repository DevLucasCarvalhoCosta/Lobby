import { MatchDetails } from '@/components/match-details';

interface PageProps {
  params: {
    matchId: string;
  };
}

export default function MatchPage({ params }: PageProps) {
  return <MatchDetails matchId={params.matchId} />;
}
