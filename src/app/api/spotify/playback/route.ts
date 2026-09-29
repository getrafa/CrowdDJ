import { NextRequest, NextResponse } from 'next/server';
import { startOrResumePlayback, pausePlayback } from '@/lib/spotify/api';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, deviceId, trackUri, roomCode, token } = body;

    let accessToken = token;

    if (!accessToken && roomCode) {
      const supabase = createServerClient();
      const { data: room } = await supabase
        .from('rooms')
        .select('host_spotify_token')
        .eq('room_code', roomCode)
        .single();
      accessToken = room?.host_spotify_token;
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token available' }, { status: 401 });
    }

    if (!deviceId) {
      return NextResponse.json({ error: 'No device ID provided' }, { status: 400 });
    }

    let success = false;
    if (action === 'play') {
      success = await startOrResumePlayback(accessToken, deviceId, trackUri);
    } else if (action === 'pause') {
      success = await pausePlayback(accessToken, deviceId);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Playback API error:', error);
    return NextResponse.json({ error: error.message || 'Playback failed' }, { status: 500 });
  }
}
