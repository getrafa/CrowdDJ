'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QueueItemWithVotes, Room, SpotifyTrack } from '@/types/database';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { getMockInitialQueue } from '@/lib/mock-data';

interface UseRoomQueueOptions {
  roomCode: string;
  guestSessionId?: string;
  isHost?: boolean;
  onAutoSkip?: (nextTrack: QueueItemWithVotes | null) => void;
}

export function useRoomQueue({
  roomCode,
  guestSessionId,
  isHost = false,
  onAutoSkip,
}: UseRoomQueueOptions) {
  const upperCode = roomCode?.toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [queue, setQueue] = useState<QueueItemWithVotes[]>([]);
  const [currentPlaying, setCurrentPlaying] = useState<QueueItemWithVotes | null>(null);
  const [activeGuests, setActiveGuests] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const onAutoSkipRef = useRef(onAutoSkip);
  onAutoSkipRef.current = onAutoSkip;

  // Compute how many active songs this guest currently has in the queue or playing
  const userRequestsCount = queue.filter(
    (item) =>
      item.guest_session_id === guestSessionId &&
      (item.status === 'queued' || item.status === 'playing')
  ).length;

  const maxRequests = room?.max_requests_per_user || 3;
  const isLimitReached = !isHost && userRequestsCount >= maxRequests;

  // Helper to sort queue items: highest score first, then earliest created_at
  const sortQueueItems = useCallback((items: QueueItemWithVotes[]) => {
    const playing = items.find((i) => i.status === 'playing') || null;
    const queued = items
      .filter((i) => i.status === 'queued')
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    return { playing, queued };
  }, []);

  // Fetch initial queue and room data
  const fetchRoomData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch room details
      const roomRes = await fetch(`/api/rooms/${upperCode}`);
      if (!roomRes.ok) {
        throw new Error('Room not found or inactive');
      }
      const roomData = await roomRes.json();
      setRoom(roomData.room);

      // Fetch queue items
      const queueUrl = `/api/rooms/${upperCode}/queue${
        guestSessionId ? `?guestSessionId=${guestSessionId}` : ''
      }`;
      const queueRes = await fetch(queueUrl);
      const queueData = await queueRes.json();

      if (queueData.queue) {
        const { playing, queued } = sortQueueItems(queueData.queue);
        setCurrentPlaying(playing);
        setQueue(queued);
      }
    } catch (err: any) {
      console.warn('Using local fallback queue data:', err.message);
      // Fallback initial state
      const fallbackQueue = getMockInitialQueue(upperCode).map((item) => ({
        ...item,
        upvotes: Math.max(0, item.score),
        downvotes: item.score < 0 ? Math.abs(item.score) : 0,
        userVote: 0 as const,
      }));
      const { playing, queued } = sortQueueItems(fallbackQueue);
      setCurrentPlaying(playing);
      setQueue(queued);
      setRoom({
        id: `demo-${upperCode}`,
        room_code: upperCode,
        is_active: true,
        skip_threshold_percent: 60,
        max_requests_per_user: 3,
        created_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [upperCode, guestSessionId, sortQueueItems]);

  // Setup BroadcastChannel for zero-config multi-window sync on local machines
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const channel = new BroadcastChannel(`crowddj_${upperCode}`);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'QUEUE_UPDATE') {
          const { playing, queued } = sortQueueItems(payload);
          setCurrentPlaying(playing);
          setQueue(queued);
        } else if (type === 'AUTO_SKIP') {
          if (isHost && onAutoSkipRef.current) {
            onAutoSkipRef.current(payload.nextTrack);
          }
        } else if (type === 'PRESENCE_PING') {
          // Increment or track presence
          setActiveGuests((prev) => Math.max(prev, payload.count || 2));
        }
      };

      // Broadcast join presence
      channel.postMessage({ type: 'PRESENCE_PING', payload: { count: 2 } });
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment');
    }

    return () => {
      broadcastChannelRef.current?.close();
    };
  }, [upperCode, isHost, sortQueueItems]);

  // Setup Supabase Realtime Subscriptions
  useEffect(() => {
    fetchRoomData();

    if (!isSupabaseConfigured()) {
      return;
    }

    const supabase = createClient();
    const channelName = `room:${upperCode}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: guestSessionId || (isHost ? 'host' : 'guest_' + Math.random()),
        },
      },
    });

    // 1. Listen for queue_items table changes
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_items',
          filter: `room_code=eq.${upperCode}`,
        },
        () => {
          // Refresh queue when any track changes
          fetchRoomData();
        }
      )
      // 2. Listen for votes table changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
        },
        () => {
          // Refresh queue to update vote counts & order
          fetchRoomData();
        }
      )
      // 3. Supabase Realtime Presence to count active guests
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const totalUsers = Object.keys(state).length;
        setActiveGuests(Math.max(1, totalUsers));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            is_host: isHost,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [upperCode, guestSessionId, isHost, fetchRoomData]);

  // Check auto-skip conditions whenever current track downvotes or active guests change
  const checkAutoSkip = useCallback(
    (item: QueueItemWithVotes, downvotes: number, guests: number) => {
      const thresholdPercent = room?.skip_threshold_percent || 60;
      const totalGuests = Math.max(1, guests);
      const ratio = downvotes / totalGuests;

      if (ratio >= thresholdPercent / 100) {
        // Trigger auto-skip
        if (isHost && onAutoSkipRef.current) {
          const nextTrack = queue[0] || null;
          onAutoSkipRef.current(nextTrack);
        }
        broadcastChannelRef.current?.postMessage({
          type: 'AUTO_SKIP',
          payload: { nextTrack: queue[0] || null },
        });
      }
    },
    [room, queue, isHost]
  );

  // Cast vote on a track (+1 or -1)
  const castVote = async (queueItemId: string, voteType: 1 | -1) => {
    if (!guestSessionId) return;

    // Optimistic UI update
    const updateItemVotes = (item: QueueItemWithVotes): QueueItemWithVotes => {
      if (item.id !== queueItemId) return item;

      const prevVote = item.userVote || 0;
      let newVote: 1 | -1 | 0 = voteType;
      let scoreDiff = 0;
      let newUpvotes = item.upvotes;
      let newDownvotes = item.downvotes;

      if (prevVote === voteType) {
        // Untoggle vote
        newVote = 0;
        scoreDiff = -voteType;
        if (voteType === 1) newUpvotes = Math.max(0, newUpvotes - 1);
        if (voteType === -1) newDownvotes = Math.max(0, newDownvotes - 1);
      } else if (prevVote === 0) {
        // New vote
        scoreDiff = voteType;
        if (voteType === 1) newUpvotes += 1;
        if (voteType === -1) newDownvotes += 1;
      } else {
        // Change vote (+1 to -1 or -1 to +1)
        scoreDiff = voteType * 2;
        if (voteType === 1) {
          newUpvotes += 1;
          newDownvotes = Math.max(0, newDownvotes - 1);
        } else {
          newDownvotes += 1;
          newUpvotes = Math.max(0, newUpvotes - 1);
        }
      }

      const updated = {
        ...item,
        score: item.score + scoreDiff,
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        userVote: newVote,
      };

      if (updated.status === 'playing') {
        checkAutoSkip(updated, newDownvotes, activeGuests);
      }

      return updated;
    };

    if (currentPlaying?.id === queueItemId) {
      setCurrentPlaying((prev) => (prev ? updateItemVotes(prev) : null));
    } else {
      setQueue((prevQueue) => {
        const updated = prevQueue.map(updateItemVotes);
        return updated.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      });
    }

    try {
      const res = await fetch(`/api/rooms/${upperCode}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueItemId,
          guestSessionId,
          voteType,
          activeGuestCount: activeGuests,
        }),
      });

      const data = await res.json();
      if (data.autoSkipped && isHost && onAutoSkipRef.current) {
        onAutoSkipRef.current(queue[0] || null);
      }

      // Sync across broadcast channel
      if (broadcastChannelRef.current) {
        const fullList = currentPlaying ? [currentPlaying, ...queue] : queue;
        broadcastChannelRef.current.postMessage({
          type: 'QUEUE_UPDATE',
          payload: fullList,
        });
      }
    } catch (err) {
      console.error('Failed to submit vote:', err);
    }
  };

  // Add track to queue
  const addTrackToQueue = async (track: SpotifyTrack, guestName: string) => {
    if (isLimitReached) {
      throw new Error(`Request limit reached (${maxRequests} songs max per guest)`);
    }

    const payload = {
      trackUri: track.uri,
      trackName: track.name,
      artistName: track.artists.map((a) => a.name).join(', '),
      albumArtUrl: track.album.images[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
      durationMs: track.duration_ms,
      requestedByName: guestName,
      guestSessionId: guestSessionId || 'anon',
    };

    const res = await fetch(`/api/rooms/${upperCode}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add track to queue');
    }

    // Refresh data
    await fetchRoomData();

    // Broadcast update
    if (broadcastChannelRef.current) {
      const fullList = currentPlaying ? [currentPlaying, ...queue] : queue;
      broadcastChannelRef.current.postMessage({
        type: 'QUEUE_UPDATE',
        payload: fullList,
      });
    }

    return data.item;
  };

  // Skip or Veto track (Host action or Auto-Skip trigger)
  const skipTrack = async (action: 'skip' | 'veto' | 'finish' = 'skip') => {
    try {
      const res = await fetch(`/api/rooms/${upperCode}/queue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          queueItemId: currentPlaying?.id,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to skip track');
      }

      const data = await res.json();

      // Update state locally
      if (queue.length > 0) {
        const [nextItem, ...remaining] = queue;
        setCurrentPlaying({ ...nextItem, status: 'playing' });
        setQueue(remaining);

        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({
            type: 'QUEUE_UPDATE',
            payload: [{ ...nextItem, status: 'playing' }, ...remaining],
          });
        }

        return nextItem;
      } else {
        setCurrentPlaying(null);
        return null;
      }
    } catch (err) {
      console.error('Error transitioning track:', err);
      return null;
    }
  };

  return {
    room,
    queue,
    currentPlaying,
    activeGuests,
    userRequestsCount,
    maxRequests,
    isLimitReached,
    loading,
    error,
    castVote,
    addTrackToQueue,
    skipTrack,
    refreshQueue: fetchRoomData,
  };
}
