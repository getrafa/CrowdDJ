import { cookies } from 'next/headers';
import { HostDashboard } from '@/components/host/HostDashboard';
import { createServerClient } from '@/lib/supabase/server';

interface HostPageProps {
  params: Promise<{ roomCode: string }>;
  searchParams: Promise<{ token?: string; refresh?: string }>;
}

export default async function HostPage({ params, searchParams }: HostPageProps) {
  const { roomCode } = await params;
  const { token } = await searchParams;
  const cookieStore = await cookies();
  let hostToken = token || cookieStore.get('spotify_access_token')?.value || null;

  if (!hostToken) {
    try {
      const supabase = createServerClient();
      const { data: room } = await supabase
        .from('rooms')
        .select('host_spotify_token')
        .eq('room_code', roomCode.toUpperCase())
        .single();
      if (room?.host_spotify_token) {
        hostToken = room.host_spotify_token;
      }
    } catch (e) {
      console.warn('Could not query host token:', e);
    }
  }

  return <HostDashboard roomCode={roomCode} initialToken={hostToken} />;
}

