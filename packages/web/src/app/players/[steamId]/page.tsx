import { PlayerProfile } from '@/components/player-profile';

interface PageProps {
  params: {
    steamId: string;
  };
}

export default function PlayerPage({ params }: PageProps) {
  return <PlayerProfile steamId={params.steamId} />;
}
