export type QueueStatus = 'queued' | 'playing' | 'played' | 'skipped';

export interface Room {
  id: string;
  room_code: string;
  host_spotify_token?: string | null;
  host_spotify_refresh_token?: string | null;
  host_spotify_user_id?: string | null;
  is_active: boolean;
  skip_threshold_percent: number;
  max_requests_per_user: number;
  created_at: string;
}

export interface QueueItem {
  id: string;
  room_code: string;
  track_uri: string;
  track_name: string;
  artist_name: string;
  album_art_url: string;
  duration_ms: number;
  requested_by_name: string;
  guest_session_id: string;
  status: QueueStatus;
  score: number;
  created_at: string;
}

export interface Vote {
  id: string;
  queue_item_id: string;
  guest_session_id: string;
  vote_type: 1 | -1;
  created_at: string;
}

export interface QueueItemWithVotes extends QueueItem {
  upvotes: number;
  downvotes: number;
  userVote?: 1 | -1 | 0;
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
}
