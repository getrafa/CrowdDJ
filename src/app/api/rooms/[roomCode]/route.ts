import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const upperCode = roomCode.toUpperCase();

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', upperCode)
        .single();

      if (error || !room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      return NextResponse.json({ room });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // Fallback demo room
  return NextResponse.json({
    room: {
      id: `demo-${upperCode}`,
      room_code: upperCode,
      is_active: true,
      skip_threshold_percent: 60,
      max_requests_per_user: 3,
      created_at: new Date().toISOString(),
    },
  });
}
