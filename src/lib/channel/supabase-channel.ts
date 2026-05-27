/**
 * SupabaseChannel — uses Supabase Realtime Presence + Broadcast.
 *
 * Works across different devices and networks.
 * Requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 *
 * Presence: Supabase Presence (automatic join/leave/sync)
 * Chat/Sync/Signal: Supabase Broadcast (low-latency, no persistence)
 */

import type {
  RoomChannelAdapter,
  PresenceInfo,
  ChatPayload,
  SyncPayload,
  SignalPayload,
  ModerationPayload,
  ChannelEvent,
  ChannelEventHandler,
} from './types'

// Lazy-load Supabase so the app doesn't crash when it isn't configured
let supabaseModule: typeof import('@supabase/supabase-js') | null = null

async function getSupabase(url: string, key: string) {
  if (!supabaseModule) {
    supabaseModule = await import('@supabase/supabase-js')
  }
  return supabaseModule.createClient(url, key, {
    realtime: { params: { eventsPerSecond: 20 } },
  })
}

type SupabaseClient = Awaited<ReturnType<typeof getSupabase>>
type RealtimeChannel = ReturnType<SupabaseClient['channel']>

export class SupabaseChannel implements RoomChannelAdapter {
  private client: SupabaseClient | null = null
  private channel: RealtimeChannel | null = null
  private handlers = new Set<ChannelEventHandler>()
  private presence: Record<string, PresenceInfo> = {}
  private myInfo: PresenceInfo | null = null
  private _connected = false

  constructor(
    private roomId: string,
    private supabaseUrl: string,
    private supabaseKey: string
  ) {}

  get isConnected() { return this._connected }

  async join(info: PresenceInfo): Promise<void> {
    this.myInfo = info
    this.client = await getSupabase(this.supabaseUrl, this.supabaseKey)
    this.channel = this.client.channel(`room:${this.roomId}`, {
      config: { presence: { key: info.participantId } },
    })

    // ── Presence ──────────────────────────────────────────────────
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel!.presenceState<PresenceInfo>()
      this.presence = {}
      for (const [, presences] of Object.entries(state)) {
        const p = presences[0] as unknown as PresenceInfo
        if (p?.participantId) this.presence[p.participantId] = p
      }
      this.emit({ kind: 'presence-sync', presence: this.presence })
    })

    this.channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      for (const p of newPresences as unknown as PresenceInfo[]) {
        if (p?.participantId) {
          this.presence[p.participantId] = p
          this.emit({ kind: 'presence-join', participant: p })
        }
      }
    })

    this.channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const p of leftPresences as unknown as PresenceInfo[]) {
        if (p?.participantId) {
          delete this.presence[p.participantId]
          this.emit({ kind: 'presence-leave', participantId: p.participantId })
        }
      }
    })

    // ── Broadcast ─────────────────────────────────────────────────
    this.channel.on('broadcast', { event: 'chat' }, ({ payload }: { payload: ChatPayload }) => {
      this.emit({ kind: 'chat', message: payload })
    })

    this.channel.on('broadcast', { event: 'sync' }, ({ payload }: { payload: SyncPayload }) => {
      this.emit({ kind: 'sync', event: payload })
    })

    this.channel.on('broadcast', { event: 'signal' }, ({ payload }: { payload: SignalPayload }) => {
      this.emit({ kind: 'signal', signal: payload })
    })

    this.channel.on('broadcast', { event: 'moderation' }, ({ payload }: { payload: ModerationPayload }) => {
      this.emit({ kind: 'moderation', payload })
    })

    // Subscribe and track presence
    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel!.track(info)
          this._connected = true
          resolve()
        } else if (status === 'CHANNEL_ERROR') {
          reject(new Error('Supabase channel error'))
        }
      })
    })
  }

  leave(): void {
    if (!this._connected) return
    this._connected = false
    this.channel?.untrack()
    this.channel?.unsubscribe()
    this.channel = null
    this.client = null
  }

  updatePresence(patch: Partial<PresenceInfo>): void {
    if (!this.myInfo || !this.channel) return
    this.myInfo = { ...this.myInfo, ...patch }
    this.channel.track(this.myInfo)
  }

  sendChat(msg: ChatPayload): void {
    this.channel?.send({ type: 'broadcast', event: 'chat', payload: msg })
    // Supabase broadcast doesn't echo to sender — emit locally
    this.emit({ kind: 'chat', message: msg })
  }

  sendSync(event: SyncPayload): void {
    this.channel?.send({ type: 'broadcast', event: 'sync', payload: event })
    this.emit({ kind: 'sync', event })
  }

  sendSignal(signal: SignalPayload): void {
    this.channel?.send({ type: 'broadcast', event: 'signal', payload: signal })
  }

  sendModeration(payload: ModerationPayload): void {
    this.channel?.send({ type: 'broadcast', event: 'moderation', payload })
    // Self-echo so the host sees their own action's UI side-effect locally
    this.emit({ kind: 'moderation', payload })
  }

  on(handler: ChannelEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  getPresence(): Record<string, PresenceInfo> {
    return { ...this.presence }
  }

  private emit(event: ChannelEvent): void {
    this.handlers.forEach(h => h(event))
  }
}
