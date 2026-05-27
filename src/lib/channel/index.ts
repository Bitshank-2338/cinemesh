import { LocalChannel } from './local-channel'
import { SupabaseChannel } from './supabase-channel'
import type { RoomChannelAdapter } from './types'

export type { RoomChannelAdapter, PresenceInfo, ChatPayload, SyncPayload, SignalPayload, ChannelEvent, ChannelEventHandler, SyncAction, ModerationPayload, ModerationAction, StreamRolesPayload } from './types'

/**
 * createChannel — picks the appropriate transport automatically.
 *
 * • If Supabase env vars are configured → SupabaseChannel (cross-device)
 * • Otherwise → LocalChannel (same-browser BroadcastChannel, zero-config)
 */
export function createChannel(roomId: string): RoomChannelAdapter {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const configured =
    url && key &&
    !url.includes('your-project') &&
    !key.includes('your-anon') &&
    url.startsWith('https://')

  if (configured) {
    return new SupabaseChannel(roomId, url!, key!)
  }

  return new LocalChannel(roomId)
}

export function getTransportLabel(roomId: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const configured = url && key && !url.includes('your-project') && url.startsWith('https://')
  return configured ? 'supabase' : 'local'
}
