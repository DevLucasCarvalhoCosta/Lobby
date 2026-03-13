'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { refetchUser } = useAuth();

  useEffect(() => {
    refetchUser().then(() => {
      router.push('/');
    });
  }, [refetchUser, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-12 h-12 animate-spin text-radiant" />
      <p className="mt-4 text-dota-text-secondary">Completing login...</p>
    </div>
  );
}
