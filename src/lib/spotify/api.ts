const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
].join(' ');

export function getSpotifyAuthUrl(roomCode?: string, customOrigin?: string): string {
  // Use the exact origin the user is currently visiting (e.g. acomusic.vercel.app)
  const origin = customOrigin || process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3000';
  const redirectUri = `${origin}/api/auth/spotify/callback`;
  const state = roomCode ? `room_${roomCode}` : `new_${Date.now()}`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state: state,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    token_type: string;
    scope: string;
    expires_in: number;
    refresh_token: string;
  }>;
}

export async function refreshSpotifyToken(refreshToken: string) {
  const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    token_type: string;
    scope: string;
    expires_in: number;
    refresh_token?: string;
  }>;
}

export async function getSpotifyUserProfile(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }

  return response.json();
}

export async function getUserPlaylists(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch playlists: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

export async function getPlaylistTracks(playlistId: string, accessToken: string) {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch playlist tracks: ${response.statusText}`);
  }

  const data = await response.json();
  // Filter out null tracks or podcasts
  return (data.items || [])
    .map((item: any) => item.track)
    .filter((track: any) => track && track.id && track.uri);
}

export async function searchSpotifyTracks(query: string, accessToken?: string) {
  if (!query.trim()) return [];

  // If no accessToken is passed or placeholder, we attempt client credentials or fallback
  if (!accessToken || accessToken === 'mock_token' || accessToken.includes('placeholder')) {
    // If Spotify credentials exist, get client credentials token
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && !SPOTIFY_CLIENT_ID.includes('mock')) {
      try {
        const clientId = SPOTIFY_CLIENT_ID.trim();
        const clientSecret = SPOTIFY_CLIENT_SECRET.trim();
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          accessToken = tokenData.access_token;
        } else {
        }
      } catch (err) {
        console.error('Failed to get Spotify client credentials token:', err);
      }
    }
  }

  if (!accessToken || accessToken.includes('mock') || accessToken.includes('placeholder')) {
    // Return filtered mock results for zero-config testing
    const { INITIAL_MOCK_TRACKS } = await import('@/lib/mock-data');
    return INITIAL_MOCK_TRACKS.filter(t => 
      t.name.toLowerCase().includes(query.toLowerCase()) || 
      t.artists.some(a => a.name.toLowerCase().includes(query.toLowerCase()))
    );
  }

  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Spotify search failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.tracks?.items || [];
}

export async function startOrResumePlayback(accessToken: string, deviceId: string, trackUri?: string) {
  const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
  const body = trackUri ? JSON.stringify({ uris: [trackUri] }) : undefined;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  return response.ok;
}

export async function pausePlayback(accessToken: string, deviceId: string) {
  const url = `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.ok;
}
