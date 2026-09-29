import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await params;
  const upperCode = roomCode.toUpperCase();

  try {
    const body = await request.json();
    const { queueItemId, guestSessionId, voteType, activeGuestCount } = body;

    if (!queueItemId || !guestSessionId || (voteType !== 1 && voteType !== -1)) {
      return NextResponse.json({ error: 'Invalid vote parameters' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const supabase = createServerClient();

      // Check existing vote by this guest
      const { data: existingVote } = await supabase
        .from('votes')
        .select('*')
        .eq('queue_item_id', queueItemId)
        .eq('guest_session_id', guestSessionId)
        .single();

      let currentVoteType = voteType;

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Clicking same vote removes it (toggle off)
          await supabase
            .from('votes')
            .delete()
            .eq('id', existingVote.id);
          currentVoteType = 0;
        } else {
          // Change vote (+1 -> -1 or -1 -> +1)
          await supabase
            .from('votes')
            .update({ vote_type: voteType })
            .eq('id', existingVote.id);
        }
      } else {
        // Insert new vote
        await supabase
          .from('votes')
          .insert({
            queue_item_id: queueItemId,
            guest_session_id: guestSessionId,
            vote_type: voteType,
          });
      }

      // Query current item and room to check auto-skip condition
      const { data: targetItem } = await supabase
        .from('queue_items')
        .select('id, status, score')
        .eq('id', queueItemId)
        .single();

      let autoSkipped = false;

      // Check auto-skip only if the downvoted track is currently playing
      if (targetItem && targetItem.status === 'playing') {
        const { data: room } = await supabase
          .from('rooms')
          .select('skip_threshold_percent')
          .eq('room_code', upperCode)
          .single();

        const skipThresholdPercent = room?.skip_threshold_percent ?? 60;

        // Count downvotes for this playing item
        const { count: downvoteCount } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('queue_item_id', queueItemId)
          .eq('vote_type', -1);

        const totalGuests = Math.max(1, activeGuestCount || 1);
        const downvotes = downvoteCount || 0;
        const downvoteRatio = downvotes / totalGuests;
        const thresholdRatio = skipThresholdPercent / 100;

        if (downvoteRatio >= thresholdRatio) {
          autoSkipped = true;
          // Mark current as skipped
          await supabase
            .from('queue_items')
            .update({ status: 'skipped' })
            .eq('id', queueItemId);

          // Promote next highest-voted queued item
          const { data: nextItem } = await supabase
            .from('queue_items')
            .select('*')
            .eq('room_code', upperCode)
            .eq('status', 'queued')
            .order('score', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          if (nextItem) {
            await supabase
              .from('queue_items')
              .update({ status: 'playing' })
              .eq('id', nextItem.id);
          }
        }
      }

      // Re-fetch score
      const { data: updatedItem } = await supabase
        .from('queue_items')
        .select('score')
        .eq('id', queueItemId)
        .single();

      return NextResponse.json({
        success: true,
        userVote: currentVoteType,
        score: updatedItem?.score ?? 0,
        autoSkipped,
      });
    }

    // Fallback demo voting
    return NextResponse.json({
      success: true,
      userVote: voteType,
      score: voteType === 1 ? 5 : -2,
      autoSkipped: false,
    });
  } catch (error: any) {
    console.error('Vote API error:', error);
    return NextResponse.json({ error: error.message || 'Voting failed' }, { status: 500 });
  }
}
