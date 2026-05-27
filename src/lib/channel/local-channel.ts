/**
 * LocalChannel — uses the Web BroadcastChannel API.
 *
 * Works across browser tabs on the SAME origin (same device).
 * Zero config needed. Perfect for development and single-device testing.
 *
 * Protocol:
 *   ANNOUNCE  — "I'm here, this is my presence"
 *   REQUEST   — "Please announce yourselves"
 *   LEAVE     — "I'm leaving"
 *   CHAT      — chat message
 *   SYNC      — playback sync event
 *   SIGNAL    — WebRTC signaling
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

type LocalMessage =
  | { type: 'ANNOUNCE';   presence: PresenceInfo }
  | { type: 'REQUEST' }
  | { type: 'LEAVE';      participantId: string }
  | { type: 'CHAT';       message: ChatPayload }
  | { type: 'SYNC';       event: SyncPayload }
  | { type: 'SIGNAL';     signal: SignalPayload }
  | { type: 'MOD';        payload: ModerationPayload }

const HEARTBEAT_MS = 5_000
const STALE_MS     = 15_000

export class LocalChannel implements RoomChannelAdapter {
  private bc: BroadcastChannel
  private handlers = new Set<ChannelEventHandler>()
  private presence: Record<string, PresenceInfo> = {}
  private myInfo: PresenceInfo | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private staleTimer: ReturnType<typeof setInterval> | null = null
  private lastSeen: Record<string, number> = {}
  private _connected = false

  constructor(private roomId: string) {
    this.bc = new BroadcastChannel(`cinemesh:${roomId}`)
  }

  get isConnected() { return this._connected }

  async join(info: PresenceInfo): Promise<void> {
    this.myInfo = info
    this._connected = true

    // Listen for incoming messages
    this.bc.onmessage = (ev: MessageEvent<LocalMessage>) => {
      this.handleMessage(ev.data)
    }

    // Announce self + ask everyone else to announce
    this.broadcast({ type: 'ANNOUNCE', presence: info })
    this.broadcast({ type: 'REQUEST' })

    // Heartbeat — keep announcing presence
    this.heartbeatTimer = setInterval(() => {
      if (this.myInfo) {
        this.broadcast({ type: 'ANNOUNCE', presence: this.myInfo })
      }
    }, HEARTBEAT_MS)

    // Stale peer cleanup
    this.staleTimer = setInterval(() => {
      const now = Date.now()
      const stale = Object.keys(this.lastSeen).filter(
        id => id !== this.myInfo?.participantId && now - (this.lastSeen[id] ?? 0) > STALE_MS
      )
      for (const id of stale) {
        delete this.presence[id]
        delete this.lastSeen[id]
        this.emit({ kind: 'presence-leave', participantId: id })
      }
    }, STALE_MS)

    // Clean up on tab close / navigation
    window.addEventListener('beforeunload', this.handleUnload)
  }

  leave(): void {
    if (!this._connected) return
    this._connected = false

    if (this.myInfo) {
      this.broadcast({ type: 'LEAVE', participantId: this.myInfo.participantId })
    }
    this.cleanup()
  }

  updatePresence(patch: Partial<PresenceInfo>): void {
    if (!this.myInfo) return
    this.myInfo = { ...this.myInfo, ...patch }
    this.broadcast({ type: 'ANNOUNCE', presence: this.myInfo })
    // Update local presence map
    this.presence[this.myInfo.participantId] = this.myInfo
  }

  sendChat(msg: ChatPayload): void {
    this.broadcast({ type: 'CHAT', message: msg })
    // Also emit locally so the sender sees their own message
    this.emit({ kind: 'chat', message: msg })
  }

  sendSync(event: SyncPayload): void {
    this.broadcast({ type: 'SYNC', event })
    this.emit({ kind: 'sync', event })
  }

  sendSignal(signal: SignalPayload): void {
    this.broadcast({ type: 'SIGNAL', signal })
  }

  sendModeration(payload: ModerationPayload): void {
    this.broadcast({ type: 'MOD', payload })
    // Self-echo for host UI consistency
    this.emit({ kind: 'moderation', payload })
  }

  on(handler: ChannelEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  getPresence(): Record<string, PresenceInfo> {
    return { ...this.presence }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private broadcast(msg: LocalMessage): void {
    try { this.bc.postMessage(msg) } catch { /* channel closed */ }
  }

  private emit(event: ChannelEvent): void {
    this.handlers.forEach(h => h(event))
  }

  private handleMessage(msg: LocalMessage): void {
    switch (msg.type) {
      case 'ANNOUNCE': {
        const { presence } = msg
        const isNew = !this.presence[presence.participantId]
        this.presence[presence.participantId] = presence
        this.lastSeen[presence.participantId] = Date.now()

        if (isNew) {
          this.emit({ kind: 'presence-join', participant: presence })
          // Full sync so new joiner gets everyone
          this.emit({ kind: 'presence-sync', presence: this.presence })
        } else {
          // Update existing — re-emit sync to keep UI fresh
          this.emit({ kind: 'presence-sync', presence: this.presence })
        }
        break
      }

      case 'REQUEST': {
        // Someone wants to know about us — announce
        if (this.myInfo) {
          this.broadcast({ type: 'ANNOUNCE', presence: this.myInfo })
        }
        break
      }

      case 'LEAVE': {
        const { participantId } = msg
        delete this.presence[participantId]
        delete this.lastSeen[participantId]
        this.emit({ kind: 'presence-leave', participantId })
        this.emit({ kind: 'presence-sync', presence: this.presence })
        break
      }

      case 'CHAT':
        this.emit({ kind: 'chat', message: msg.message })
        break

      case 'SYNC':
        this.emit({ kind: 'sync', event: msg.event })
        break

      case 'SIGNAL':
        this.emit({ kind: 'signal', signal: msg.signal })
        break

      case 'MOD':
        this.emit({ kind: 'moderation', payload: msg.payload })
        break
    }
  }

  private handleUnload = (): void => {
    this.leave()
  }

  private cleanup(): void {
    window.removeEventListener('beforeunload', this.handleUnload)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.staleTimer)    clearInterval(this.staleTimer)
    this.bc.onmessage = null
    try { this.bc.close() } catch { /* ignore */ }
  }
}
