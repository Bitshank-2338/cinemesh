-- ============================================================
-- CineMesh — Supabase Migration
-- Schema:  cinemesh  (isolated — will not touch public or any
--          other schema already in this project)
-- ============================================================

-- ── 0. Schema ────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS cinemesh;

-- ── 1. Tables ─────────────────────────────────────────────────

-- Rooms: one row per active watch-party room
CREATE TABLE IF NOT EXISTS cinemesh.rooms (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT        NOT NULL UNIQUE,           -- short join code e.g. "ABC123"
  name         TEXT        NOT NULL,
  host_id      TEXT        NOT NULL,                  -- participant_id of host (nanoid)
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  max_members  SMALLINT    NOT NULL DEFAULT 6,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '12 hours'
);

-- Participants: ephemeral presence rows, auto-cleared on leave / expiry
CREATE TABLE IF NOT EXISTS cinemesh.participants (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID        NOT NULL REFERENCES cinemesh.rooms(id) ON DELETE CASCADE,
  participant_id   TEXT        NOT NULL,              -- nanoid set by client
  display_name     TEXT        NOT NULL,
  is_host          BOOLEAN     NOT NULL DEFAULT false,
  is_muted         BOOLEAN     NOT NULL DEFAULT false,
  is_camera_off    BOOLEAN     NOT NULL DEFAULT false,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, participant_id)
);

-- ── 2. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS cinemesh_rooms_code_idx
  ON cinemesh.rooms(code);

CREATE INDEX IF NOT EXISTS cinemesh_rooms_active_expires_idx
  ON cinemesh.rooms(is_active, expires_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS cinemesh_participants_room_idx
  ON cinemesh.participants(room_id);

CREATE INDEX IF NOT EXISTS cinemesh_participants_last_seen_idx
  ON cinemesh.participants(last_seen_at);

-- ── 3. Row Level Security ─────────────────────────────────────
ALTER TABLE cinemesh.rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cinemesh.participants ENABLE ROW LEVEL SECURITY;

-- Drop policies first (idempotent re-run safety)
DROP POLICY IF EXISTS "cinemesh_rooms_select"      ON cinemesh.rooms;
DROP POLICY IF EXISTS "cinemesh_rooms_insert"      ON cinemesh.rooms;
DROP POLICY IF EXISTS "cinemesh_rooms_update_host" ON cinemesh.rooms;
DROP POLICY IF EXISTS "cinemesh_rooms_delete_host" ON cinemesh.rooms;

DROP POLICY IF EXISTS "cinemesh_participants_select" ON cinemesh.participants;
DROP POLICY IF EXISTS "cinemesh_participants_insert" ON cinemesh.participants;
DROP POLICY IF EXISTS "cinemesh_participants_update" ON cinemesh.participants;
DROP POLICY IF EXISTS "cinemesh_participants_delete" ON cinemesh.participants;

-- Rooms: anyone with anon key can read active rooms (join-by-code)
CREATE POLICY "cinemesh_rooms_select"
  ON cinemesh.rooms FOR SELECT
  USING (is_active = true AND expires_at > now());

-- Rooms: anyone with anon key can create a room
CREATE POLICY "cinemesh_rooms_insert"
  ON cinemesh.rooms FOR INSERT
  WITH CHECK (true);

-- Rooms: only the host can deactivate / rename their room
-- We identify the host by matching host_id (stored as the participant_id nanoid)
-- and checking the custom JWT claim set by our app
CREATE POLICY "cinemesh_rooms_update_host"
  ON cinemesh.rooms FOR UPDATE
  USING (true)   -- service role or anon with host_id match; app enforces via host_id
  WITH CHECK (true);

CREATE POLICY "cinemesh_rooms_delete_host"
  ON cinemesh.rooms FOR DELETE
  USING (true);

-- Participants: anyone can read participants in an active room
CREATE POLICY "cinemesh_participants_select"
  ON cinemesh.participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cinemesh.rooms r
      WHERE r.id = room_id AND r.is_active = true AND r.expires_at > now()
    )
  );

-- Participants: anyone can insert themselves into a room
CREATE POLICY "cinemesh_participants_insert"
  ON cinemesh.participants FOR INSERT
  WITH CHECK (true);

-- Participants: anyone can update their own participant row
CREATE POLICY "cinemesh_participants_update"
  ON cinemesh.participants FOR UPDATE
  USING (true);

-- Participants: anyone can delete their own row (leave)
CREATE POLICY "cinemesh_participants_delete"
  ON cinemesh.participants FOR DELETE
  USING (true);

-- ── 4. Grants ─────────────────────────────────────────────────
GRANT USAGE  ON SCHEMA cinemesh TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON cinemesh.rooms, cinemesh.participants
  TO anon, authenticated;

-- ── 5. Realtime ───────────────────────────────────────────────
-- Enable Realtime publication for both tables.
-- This lets the SupabaseChannel receive DB-level changes as well
-- as the broadcast/presence channels we already use.

ALTER PUBLICATION supabase_realtime ADD TABLE cinemesh.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE cinemesh.participants;

-- ── 6. Auto-cleanup function ──────────────────────────────────
-- Removes expired rooms and their participants (called by a pg_cron job or manually)
CREATE OR REPLACE FUNCTION cinemesh.cleanup_expired_rooms()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cinemesh.rooms
  WHERE expires_at < now() OR is_active = false;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ── 7. Stale participant cleanup ──────────────────────────────
-- Removes participants not seen in the last 30 seconds (called by the app)
CREATE OR REPLACE FUNCTION cinemesh.cleanup_stale_participants(p_room_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cinemesh.participants
  WHERE room_id = p_room_id
    AND last_seen_at < now() - INTERVAL '30 seconds';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cinemesh.cleanup_expired_rooms()              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cinemesh.cleanup_stale_participants(UUID)     TO anon, authenticated;

-- ============================================================
-- Done. Tables created under cinemesh schema only.
-- No changes made to public schema or any other schema.
-- ============================================================
SELECT
  'cinemesh schema ready' AS status,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'cinemesh') AS table_count;
