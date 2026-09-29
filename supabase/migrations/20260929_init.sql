-- CrowdDJ Supabase Schema Migration
-- Production-ready schema with Realtime Replication, RLS, and Auto-Score Calculation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ROOMS TABLE
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(10) NOT NULL UNIQUE,
    host_spotify_token TEXT,
    host_spotify_refresh_token TEXT,
    host_spotify_user_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    skip_threshold_percent INTEGER NOT NULL DEFAULT 60 CHECK (skip_threshold_percent >= 1 AND skip_threshold_percent <= 100),
    max_requests_per_user INTEGER NOT NULL DEFAULT 3 CHECK (max_requests_per_user >= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for instant room lookup by code
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON rooms(is_active);

-- 2. QUEUE ITEMS TABLE
CREATE TABLE IF NOT EXISTS queue_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(10) NOT NULL REFERENCES rooms(room_code) ON DELETE CASCADE,
    track_uri TEXT NOT NULL,
    track_name TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    album_art_url TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    requested_by_name TEXT NOT NULL,
    guest_session_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'played', 'skipped')),
    score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for lightning fast queue sorting and room filtering
CREATE INDEX IF NOT EXISTS idx_queue_items_room_code ON queue_items(room_code);
CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status);
CREATE INDEX IF NOT EXISTS idx_queue_items_ranking ON queue_items(room_code, status, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_queue_items_guest ON queue_items(room_code, guest_session_id);

-- 3. VOTES TABLE
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_item_id UUID NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
    guest_session_id TEXT NOT NULL,
    vote_type SMALLINT NOT NULL CHECK (vote_type IN (1, -1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_guest_vote UNIQUE (queue_item_id, guest_session_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_queue_item ON votes(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_votes_guest ON votes(guest_session_id);

-- 4. REALTIME TRIGGER FUNCTION FOR QUEUE ITEM SCORE
CREATE OR REPLACE FUNCTION update_queue_item_score()
RETURNS TRIGGER AS $$
DECLARE
    target_id UUID;
    calculated_score INTEGER;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_id := OLD.queue_item_id;
    ELSE
        target_id := NEW.queue_item_id;
    END IF;

    -- Calculate total score: sum of (+1) and (-1) votes
    SELECT COALESCE(SUM(vote_type), 0)
    INTO calculated_score
    FROM votes
    WHERE queue_item_id = target_id;

    -- Update score in queue_items table
    UPDATE queue_items
    SET score = calculated_score
    WHERE id = target_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger whenever a vote is added, changed, or removed
DROP TRIGGER IF EXISTS trg_update_score ON votes;
CREATE TRIGGER trg_update_score
AFTER INSERT OR UPDATE OR DELETE ON votes
FOR EACH ROW
EXECUTE FUNCTION update_queue_item_score();

-- 5. ENABLE SUPABASE REALTIME REPLICATION
-- Replica Identity Full ensures update/delete payloads contain full record
ALTER TABLE rooms REPLICA IDENTITY FULL;
ALTER TABLE queue_items REPLICA IDENTITY FULL;
ALTER TABLE votes REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'queue_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE queue_items;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'votes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE votes;
    END IF;
END $$;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Rooms policies: public read, public create
CREATE POLICY "Public read active rooms" ON rooms
    FOR SELECT USING (true);

CREATE POLICY "Public create rooms" ON rooms
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update rooms" ON rooms
    FOR UPDATE USING (true);

-- Queue Items policies: public read, insert, update
CREATE POLICY "Public read queue items" ON queue_items
    FOR SELECT USING (true);

CREATE POLICY "Public insert queue items" ON queue_items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update queue items" ON queue_items
    FOR UPDATE USING (true);

CREATE POLICY "Public delete queue items" ON queue_items
    FOR DELETE USING (true);

-- Votes policies: public read, insert, update, delete
CREATE POLICY "Public read votes" ON votes
    FOR SELECT USING (true);

CREATE POLICY "Public insert votes" ON votes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update votes" ON votes
    FOR UPDATE USING (true);

CREATE POLICY "Public delete votes" ON votes
    FOR DELETE USING (true);
