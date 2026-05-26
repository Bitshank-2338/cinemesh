import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── cinemesh schema types ─────────────────────────────────────────────────
export interface DbRoom {
  id:          string
  code:        string
  name:        string
  host_id:     string
  is_active:   boolean
  max_members: number
  created_at:  string
  expires_at:  string
}

export interface DbParticipant {
  id:             string
  room_id:        string
  participant_id: string
  display_name:   string
  is_host:        boolean
  is_muted:       boolean
  is_camera_off:  boolean
  joined_at:      string
  last_seen_at:   string
}

export type CinemeshSchema = {
  public: { Tables: Record<string, never>; Views: Record<string, never> }
}

// ─── Singletons ───────────────────────────────────────────────────────────────
// ReturnType is used so the schema-specific client doesn't need to match the
// default 'public' schema generic — both are valid SupabaseClient instances.
type AnySupabase = ReturnType<typeof createClient>
let _default:  AnySupabase | null = null   // for Realtime channels
let _cinemesh: AnySupabase | null = null   // for cinemesh schema queries

// Strip BOM, surrounding quotes, and whitespace — env vars set via CLI from
// Windows/PowerShell sometimes pick up a UTF-8 BOM (﻿) which silently
// breaks URL prefix checks. This sanitizer makes the check robust.
function clean(v: string | undefined): string {
  if (!v) return ''
  return v.replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim()
}

const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
const key = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

function isConfigured(): boolean {
  return !!(url && key && url.startsWith('https://') && !url.includes('your-project'))
}

/** Default client — used for Realtime (schema-agnostic). */
export function getSupabase(): AnySupabase | null {
  if (!isConfigured()) return null
  if (!_default) {
    _default = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 20 } },
    })
  }
  return _default
}

/**
 * cinemesh-schema client — all .from() calls route to the cinemesh schema.
 * Uses PostgREST Accept-Profile / Content-Profile headers automatically.
 */
export function getCinemeshClient(): AnySupabase | null {
  if (!isConfigured()) return null
  if (!_cinemesh) {
    // createClient's generic restricts db.schema to typed schemas.
    // We double-cast through unknown to pass the runtime 'cinemesh' string.
    _cinemesh = createClient(url, key, ({
      db:       { schema: 'cinemesh' },
      realtime: { params: { eventsPerSecond: 20 } },
    }) as unknown as Parameters<typeof createClient>[2])
  }
  return _cinemesh
}

export { isConfigured as isSupabaseConfigured }
