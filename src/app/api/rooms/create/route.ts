import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateRoomCode } from '@/lib/utils';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const skipThreshold = body.skipThresholdPercent ?? 60;
    const maxRequests = body.maxRequestsPerUser ?? 3;
    const customCode = body.roomCode?.toUpperCase();

    const roomCode = customCode || generateRoomCode();

    const newRoom = {
      id: crypto.randomUUID(),
      room_code: roomCode,
      skip_threshold_percent: Math.max(1, Math.min(100, skipThreshold)),
      max_requests_per_user: Math.max(1, maxRequests),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('rooms')
        .insert(newRoom)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ room: data });
    }

    // In demo / fallback mode
    return NextResponse.json({ room: newRoom });
  } catch (error: any) {
    console.error('Create room error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create room' }, { status: 500 });
  }
}
