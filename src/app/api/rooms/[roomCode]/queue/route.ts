import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getMockInitialQueue } from '@/lib/mock-data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const upperCode = roomCode.toUpperCase();
  const guestSessionId = request.nextUrl.searchParams.get('guestSessionId');

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const { data: items, error } = await supabase
        .from('queue_items')
        .select('*')
        .eq('room_code', upperCode)
        .order('score', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Fetch user votes if guestSessionId is provided
      let userVotes: Record<string, number> = {};
      if (guestSessionId) {
        const { data: votes } = await supabase
          .from('votes')
          .select('queue_item_id, vote_type')
          .eq('guest_session_id', guestSessionId);

        votes?.forEach((v) => {
          userVotes[v.queue_item_id] = v.vote_type;
        });
      }

      // Fetch upvote/downvote totals per item
      const itemIds = items.map((i) => i.id);
      let voteCounts: Record<string, { upvotes: number; downvotes: number }> = {};
      
      if (itemIds.length > 0) {
        const { data: allVotes } = await supabase
          .from('votes')
          .select('queue_item_id, vote_type')
          .in('queue_item_id', itemIds);

        allVotes?.forEach((v) => {
          if (!voteCounts[v.queue_item_id]) {
            voteCounts[v.queue_item_id] = { upvotes: 0, downvotes: 0 };
          }
          if (v.vote_type === 1) voteCounts[v.queue_item_id].upvotes++;
          if (v.vote_type === -1) voteCounts[v.queue_item_id].downvotes++;
        });
      }

      const itemsWithVotes = items.map((item) => ({
        ...item,
        upvotes: voteCounts[item.id]?.upvotes || 0,
        downvotes: voteCounts[item.id]?.downvotes || 0,
        userVote: userVotes[item.id] || 0,
      }));

      return NextResponse.json({ queue: itemsWithVotes });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // Fallback mock queue
  const mockQueue = getMockInitialQueue(upperCode);
  return NextResponse.json({
    queue: mockQueue.map((item) => ({
      ...item,
      upvotes: Math.max(0, item.score),
      downvotes: item.score < 0 ? Math.abs(item.score) : 0,
      userVote: 0,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const upperCode = roomCode.toUpperCase();

  try {
    const body = await request.json();
    const {
      trackUri,
      trackName,
      artistName,
      albumArtUrl,
      durationMs,
      requestedByName,
      guestSessionId,
    } = body;

    if (!trackUri || !trackName || !guestSessionId) {
      return NextResponse.json(
        { error: 'Missing required track or guest information' },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const supabase = createServerClient();

      // 1. Check room settings for max_requests_per_user
      const { data: room } = await supabase
        .from('rooms')
        .select('max_requests_per_user, is_active')
        .eq('room_code', upperCode)
        .single();

      if (!room || !room.is_active) {
        return NextResponse.json({ error: 'Room is inactive or does not exist' }, { status: 404 });
      }

      const maxLimit = room.max_requests_per_user || 3;

      // 2. Count active queued or playing requests made by this guest
      const { count, error: countError } = await supabase
        .from('queue_items')
        .select('*', { count: 'exact', head: true })
        .eq('room_code', upperCode)
        .eq('guest_session_id', guestSessionId)
        .in('status', ['queued', 'playing']);

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 });
      }

      if ((count || 0) >= maxLimit) {
        return NextResponse.json(
          {
            error: `You reached the maximum limit of ${maxLimit} active requests in this room! Wait for one of your songs to finish playing.`,
            limitReached: true,
          },
          { status: 403 }
        );
      }

      // 3. Check if anything is currently playing
      const { data: playingItems } = await supabase
        .from('queue_items')
        .select('id')
        .eq('room_code', upperCode)
        .eq('status', 'playing');

      const isQueueEmpty = !playingItems || playingItems.length === 0;
      const initialStatus = isQueueEmpty ? 'playing' : 'queued';

      // 4. Insert queue item
      const newItem = {
        room_code: upperCode,
        track_uri: trackUri,
        track_name: trackName,
        artist_name: artistName,
        album_art_url: albumArtUrl,
        duration_ms: durationMs || 0,
        requested_by_name: requestedByName || 'Anonymous',
        guest_session_id: guestSessionId,
        status: initialStatus,
        score: 1, // requester auto-upvotes their own song!
      };

      const { data: insertedItem, error: insertError } = await supabase
        .from('queue_items')
        .insert(newItem)
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }

      // Add requester's initial upvote
      await supabase.from('votes').insert({
        queue_item_id: insertedItem.id,
        guest_session_id: guestSessionId,
        vote_type: 1,
      });

      return NextResponse.json({ item: insertedItem, status: initialStatus });
    }

    // Mock response when offline / demo
    const mockItem = {
      id: `mock-${Date.now()}`,
      room_code: upperCode,
      track_uri: trackUri,
      track_name: trackName,
      artist_name: artistName,
      album_art_url: albumArtUrl,
      duration_ms: durationMs || 0,
      requested_by_name: requestedByName || 'Anonymous',
      guest_session_id: guestSessionId,
      status: 'queued' as const,
      score: 1,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ item: mockItem, status: 'queued' });
  } catch (error: any) {
    console.error('Add to queue error:', error);
    return NextResponse.json({ error: error.message || 'Failed to add track' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const upperCode = roomCode.toUpperCase();

  try {
    const body = await request.json();
    const { action, queueItemId } = body;
    // action: 'skip' | 'finish' | 'veto'

    if (isSupabaseConfigured()) {
      const supabase = createServerClient();

      let targetItemId = queueItemId;

      // If no queueItemId passed, find the currently playing item
      if (!targetItemId) {
        const { data: currentPlaying } = await supabase
          .from('queue_items')
          .select('id')
          .eq('room_code', upperCode)
          .eq('status', 'playing')
          .single();
        targetItemId = currentPlaying?.id;
      }

      if (targetItemId) {
        const newStatus = action === 'veto' ? 'skipped' : (action === 'skip' ? 'skipped' : 'played');
        await supabase
          .from('queue_items')
          .update({ status: newStatus })
          .eq('id', targetItemId);
      }

      // Find top-ranked queued song to set to 'playing'
      const { data: nextTopItem } = await supabase
        .from('queue_items')
        .select('*')
        .eq('room_code', upperCode)
        .eq('status', 'queued')
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      let newlyPlayingItem = null;
      if (nextTopItem) {
        const { data: updatedNext } = await supabase
          .from('queue_items')
          .update({ status: 'playing' })
          .eq('id', nextTopItem.id)
          .select()
          .single();
        newlyPlayingItem = updatedNext;
      }

      return NextResponse.json({
        success: true,
        previousItemId: targetItemId,
        nextPlayingItem: newlyPlayingItem,
      });
    }

    return NextResponse.json({ success: true, message: 'Mock track transitioned' });
  } catch (error: any) {
    console.error('Queue transition error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update queue' }, { status: 500 });
  }
}
