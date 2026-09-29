import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getSpotifyUserProfile } from '@/lib/spotify/api';
import { createServerClient } from '@/lib/supabase/server';
import { generateRoomCode } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state') || '';
  const error = searchParams.get('error');

  const appUrl = request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/?error=${encodeURIComponent(error || 'auth_failed')}`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/spotify/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    let roomCode = '';
    if (state.startsWith('room_')) {
      roomCode = state.replace('room_', '').toUpperCase();
    } else {
      roomCode = generateRoomCode();
    }

    let spotifyUserId = 'host';
    try {
      const profile = await getSpotifyUserProfile(tokens.access_token);
      spotifyUserId = profile.id;
    } catch (err) {
      console.warn('Could not fetch Spotify profile:', err);
    }

    // Try saving to Supabase if configured
    try {
      const supabase = createServerClient();
      await supabase.from('rooms').upsert(
        {
          room_code: roomCode,
          host_spotify_token: tokens.access_token,
          host_spotify_refresh_token: tokens.refresh_token,
          host_spotify_user_id: spotifyUserId,
          is_active: true,
        },
        { onConflict: 'room_code' }
      );
    } catch (dbErr) {
      console.warn('Supabase not configured or failed to save room:', dbErr);
    }

    const response = NextResponse.redirect(
      `${appUrl}/host/${roomCode}?token=${tokens.access_token}&refresh=${tokens.refresh_token}`
    );

    // Set auth cookie
    response.cookies.set('spotify_access_token', tokens.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokens.expires_in || 3600,
      path: '/',
    });

    if (tokens.refresh_token) {
      response.cookies.set('spotify_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 3600,
        path: '/',
      });
    }

    return response;
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl}/?error=${encodeURIComponent(err.message || 'token_exchange_failed')}`);
  }
}
