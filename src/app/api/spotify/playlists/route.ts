import { NextRequest, NextResponse } from 'next/server';
import { getUserPlaylists, refreshSpotifyToken } from '@/lib/spotify/api';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomCode = searchParams.get('roomCode');

  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : searchParams.get('token') || request.cookies.get('spotify_access_token')?.value;

  let refreshToken: string | null = request.cookies.get('spotify_refresh_token')?.value || null;

  if (roomCode) {
    try {
      const supabase = createServerClient();
      const { data: room } = await supabase
        .from('rooms')
        .select('host_spotify_token, host_spotify_refresh_token')
        .eq('room_code', roomCode.toUpperCase())
        .single();

      if (!token && room?.host_spotify_token) {
        token = room.host_spotify_token;
      }
      if (!refreshToken && room?.host_spotify_refresh_token) {
        refreshToken = room.host_spotify_refresh_token;
      }
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

    if (refreshToken && (error.message?.includes('401') || error.message?.includes('expired') || error.message?.includes('Unauthorized'))) {
      try {
        console.log('Attempting automatic token refresh for playlists fetch...');
        const newTokens = await refreshSpotifyToken(refreshToken);
        if (newTokens.access_token) {
          if (roomCode) {
            const supabase = createServerClient();
            await supabase
              .from('rooms')
              .update({ host_spotify_token: newTokens.access_token })
              .eq('room_code', roomCode.toUpperCase());
          }
          const playlists = await getUserPlaylists(newTokens.access_token);
          const response = NextResponse.json({ playlists, newAccessToken: newTokens.access_token });
          response.cookies.set('spotify_access_token', newTokens.access_token, {
            path: '/',
            httpOnly: false,
            maxAge: 3600,
          });
          return response;
        }
      } catch (refreshErr) {
        console.error('Auto token refresh failed:', refreshErr);
      }
    }

    return NextResponse.json({ error: error.message || 'Failed to fetch playlists' }, { status: 500 });
  }
}

