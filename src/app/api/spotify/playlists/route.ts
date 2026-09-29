import { NextRequest, NextResponse } from 'next/server';
import { getUserPlaylists } from '@/lib/spotify/api';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomCode = searchParams.get('roomCode');
  let token = request.cookies.get('spotify_access_token')?.value;

  if (!token && roomCode) {
    try {
      const supabase = createServerClient();
      const { data: room } = await supabase
        .from('rooms')
        .select('host_spotify_token')
        .eq('room_code', roomCode.toUpperCase())
        .single();
      token = room?.host_spotify_token;
    } catch (err) {
      console.warn('Could not query host token:', err);
    }
  }

  if (!token) {
    return NextResponse.json({ error: 'Host not logged into Spotify' }, { status: 401 });
  }

  try {
    const playlists = await getUserPlaylists(token);
    return NextResponse.json({ playlists });
  } catch (error: any) {
    console.error('Playlists API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch playlists' }, { status: 500 });
  }
}
