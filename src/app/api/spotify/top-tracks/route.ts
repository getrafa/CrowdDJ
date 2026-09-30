import { NextRequest, NextResponse } from 'next/server';
import { searchSpotifyTracks, getClientCredentialsToken } from '@/lib/spotify/api';
import { createServerClient } from '@/lib/supabase/server';
import { INITIAL_MOCK_TRACKS } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomCode = searchParams.get('roomCode');

  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : searchParams.get('token') || request.cookies.get('spotify_access_token')?.value;

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

  // 1. Try host user top tracks
  if (token && !token.includes('mock') && !token.includes('placeholder')) {
    try {
      const res = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const tracks = data.items.map((t: any) => ({
            id: t.id,
            uri: t.uri,
            name: t.name,
            artists: t.artists || [{ id: 'artist', name: 'Unknown' }],
            album: {
              name: t.album?.name || 'Single',
              images: t.album?.images || [],
            },
            duration_ms: t.duration_ms || 180000,
          }));
          return NextResponse.json({ tracks, title: 'Your Top Tracks' });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch user top tracks:', err);
    }
  }

  // 2. Search Spotify for top party hits via client credentials
  try {
    const hits = await searchSpotifyTracks('top hits party', token);
    if (hits && hits.length > 0) {
      return NextResponse.json({ tracks: hits, title: 'Today\'s Top Party Hits' });
    }
  } catch (err) {
    console.warn('Failed to search top hits:', err);
  }

  // 3. Fallback to curated tracks
  return NextResponse.json({ tracks: INITIAL_MOCK_TRACKS, title: 'Curated Party Hits' });
}
