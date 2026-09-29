import { NextRequest, NextResponse } from 'next/server';
import { refreshSpotifyToken } from '@/lib/spotify/api';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken = body.refreshToken || request.cookies.get('spotify_refresh_token')?.value;
    const roomCode = body.roomCode;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token provided' }, { status: 400 });
    }

    const newTokens = await refreshSpotifyToken(refreshToken);

    // Update in Supabase if roomCode was provided
    if (roomCode) {
      try {
        const supabase = createServerClient();
        await supabase
          .from('rooms')
          .update({
            host_spotify_token: newTokens.access_token,
            ...(newTokens.refresh_token ? { host_spotify_refresh_token: newTokens.refresh_token } : {}),
          })
          .eq('room_code', roomCode);
      } catch (dbErr) {
        console.warn('Could not update tokens in Supabase:', dbErr);
      }
    }

    return NextResponse.json({
      accessToken: newTokens.access_token,
      expiresIn: newTokens.expires_in,
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return NextResponse.json({ error: error.message || 'Failed to refresh token' }, { status: 500 });
  }
}
