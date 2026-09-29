import { NextRequest, NextResponse } from 'next/server';
import { searchSpotifyTracks } from '@/lib/spotify/api';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const roomCode = searchParams.get('roomCode');

  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  let hostToken: string | undefined = undefined;

  if (roomCode) {
    try {
      const supabase = createServerClient();
      const { data: room } = await supabase
        .from('rooms')
        .select('host_spotify_token')
        .eq('room_code', roomCode)
        .single();

      if (room?.host_spotify_token) {
        hostToken = room.host_spotify_token;
      }
    } catch (err) {
      console.warn('Could not query host token from Supabase:', err);
    }
  }

  try {
    const tracks = await searchSpotifyTracks(query, hostToken);
    return NextResponse.json({ tracks });
  } catch (error: any) {
    console.error('Track search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
