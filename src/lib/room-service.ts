/**
 * room-service.ts — CRUD for cinemesh.rooms and cinemesh.participants.
 *
 * Uses getCinemeshClient() which already has { db: { schema: 'cinemesh' } },
 * so every .from() call targets the cinemesh schema automatically — no
 * per-call .schema() overrides needed.
 *
 * Falls back gracefully when Supabase is not configured (local/dev mode).
 */

import { getCinemeshClient, isSupabaseConfigured, type DbRoom, type DbParticipant } from './supabase'
import { generateRoomCode } from './utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateRoomInput {
  name:        string
  hostId:      string
  maxMembers?: number
  isPrivate?:  boolean
  /** Plaintext password — hashed server-side, never stored or logged in clear. */
  password?:   string
}

export type RoomServiceResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * getCinemeshClient() is typed against the public schema, but the client
 * is constructed with { db: { schema: 'cinemesh' } } so every .from() call
 * hits cinemesh at runtime. We use an interface-cast to avoid propagating
 * `unknown` throughout every query — no `any` needed.
 */
interface QB {
  insert(row: object):            QB
  upsert(row: object, opts?: object): QB
  update(patch: object):          QB
  delete():                       QB
  select(cols?: string):          QB
  eq(col: string, val: unknown):  QB
  gt(col: string, val: unknown):  QB
  maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>
  single():      Promise<{ data: unknown; error: { message: string } | null }>
  then:          Promise<{ data: unknown[]; error: { message: string } | null }>['then']
}

interface CinemeshDB {
  from(table: 'rooms' | 'participants'): QB
  rpc(
    fn: 'create_room' | 'verify_room_password' | 'delete_room',
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

function db(): CinemeshDB {
  return getCinemeshClient() as unknown as CinemeshDB
}

// ─── Room operations ──────────────────────────────────────────────────────────

/**
 * Create a new room and return the full row.
 *
 * Creation goes through the cinemesh.create_room() SECURITY DEFINER
 * function so the password is hashed (bcrypt) inside Postgres — the
 * plaintext never touches the database and the resulting hash is never
 * returned to the client.
 */
export async function createRoom(
  input: CreateRoomInput,
): Promise<RoomServiceResult<DbRoom>> {
  const isPrivate = input.isPrivate ?? false
  const hasPassword = isPrivate && !!input.password?.trim()

  if (!isSupabaseConfigured()) {
    const code = generateRoomCode()
    return {
      ok: true,
      data: {
        id:           crypto.randomUUID(),
        code,
        name:         input.name,
        host_id:      input.hostId,
        is_active:    true,
        is_private:   isPrivate,
        has_password: hasPassword,
        max_members:  input.maxMembers ?? 6,
        created_at:   new Date().toISOString(),
        expires_at:   new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      },
    }
  }

  const { data, error } = await db().rpc('create_room', {
    p_name:        input.name,
    p_host_id:     input.hostId,
    p_max_members: input.maxMembers ?? 6,
    p_is_private:  isPrivate,
    p_password:    hasPassword ? input.password!.trim() : null,
  })

  if (error) return { ok: false, error: error.message }
  // RETURNS TABLE → PostgREST returns an array of one row.
  const row = (Array.isArray(data) ? data[0] : data) as DbRoom | undefined
  if (!row) return { ok: false, error: 'Room creation returned no row.' }
  return { ok: true, data: row }
}

/**
 * Verify a join password against a private room. Returns true when the
 * password matches (or the room has no password). The comparison happens
 * entirely inside the verify_room_password() function — the stored hash
 * is never sent to the client.
 */
export async function verifyRoomPassword(
  code:     string,
  password: string,
): Promise<RoomServiceResult<boolean>> {
  if (!isSupabaseConfigured()) return { ok: true, data: true }

  const { data, error } = await db().rpc('verify_room_password', {
    p_code:     code.toUpperCase(),
    p_password: password,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data === true }
}

/** Look up an active, non-expired room by its short code. */
export async function getRoomByCode(
  code: string,
): Promise<RoomServiceResult<DbRoom | null>> {
  if (!isSupabaseConfigured()) {
    return { ok: true, data: null }   // local mode — rooms live in-memory only
  }

  const { data, error } = await db()
    .from('rooms')
    .select('id, code, name, host_id, is_active, is_private, has_password, max_members, created_at, expires_at')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as DbRoom | null }
}

/**
 * Delete a room when the host leaves. Routed through the host-checked
 * delete_room() function: the delete only succeeds when the caller
 * presents the host's secret participant_id (host_id). Cascades to
 * participants via FK ON DELETE CASCADE.
 */
export async function deactivateRoom(
  roomId: string,
  hostId: string,
): Promise<RoomServiceResult<void>> {
  if (!isSupabaseConfigured()) return { ok: true, data: undefined }

  const { error } = await db().rpc('delete_room', {
    p_room_id: roomId,
    p_host_id: hostId,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: undefined }
}

// ─── Participant operations ───────────────────────────────────────────────────

/** Upsert a participant row (join or rejoin after reload). */
export async function upsertParticipant(
  roomId: string,
  input: {
    participantId: string
    displayName:   string
    isHost:        boolean
  },
): Promise<RoomServiceResult<DbParticipant>> {
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      data: {
        id:             crypto.randomUUID(),
        room_id:        roomId,
        participant_id: input.participantId,
        display_name:   input.displayName,
        is_host:        input.isHost,
        is_muted:       false,
        is_camera_off:  false,
        joined_at:      new Date().toISOString(),
        last_seen_at:   new Date().toISOString(),
      },
    }
  }

  const { data, error } = await db()
    .from('participants')
    .upsert(
      {
        room_id:        roomId,
        participant_id: input.participantId,
        display_name:   input.displayName,
        is_host:        input.isHost,
        last_seen_at:   new Date().toISOString(),
      },
      { onConflict: 'room_id,participant_id' },
    )
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as DbParticipant }
}

/** Heartbeat + presence fields update (muted / camera-off). */
export async function updateParticipantPresence(
  roomId:        string,
  participantId: string,
  patch: { isMuted?: boolean; isCameraOff?: boolean },
): Promise<void> {
  if (!isSupabaseConfigured()) return

  await db()
    .from('participants')
    .update({
      ...(patch.isMuted      !== undefined && { is_muted:      patch.isMuted }),
      ...(patch.isCameraOff  !== undefined && { is_camera_off: patch.isCameraOff }),
      last_seen_at: new Date().toISOString(),
    })
    .eq('room_id',        roomId)
    .eq('participant_id', participantId)
}

/** Remove a participant row on leave. */
export async function removeParticipant(
  roomId:        string,
  participantId: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return

  await db()
    .from('participants')
    .delete()
    .eq('room_id',        roomId)
    .eq('participant_id', participantId)
}

/** All active participants in a room (seen within last 30 s). */
export async function getRoomParticipants(
  roomId: string,
): Promise<RoomServiceResult<DbParticipant[]>> {
  if (!isSupabaseConfigured()) return { ok: true, data: [] }

  const cutoff = new Date(Date.now() - 30_000).toISOString()
  const { data, error } = await db()
    .from('participants')
    .select('*')
    .eq('room_id', roomId)
    .gt('last_seen_at', cutoff)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as DbParticipant[] }
}
