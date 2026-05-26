// ─── Presence ─────────────────────────────────────────────────────────────────
export interface PresenceInfo {
  participantId: string
  name: string
  isMuted: boolean
  isCameraOff: boolean
  isHost: boolean
  joinedAt: number
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatPayload {
  id: string
  participantId: string
  participantName: string
  content: string
  timestamp: number
  type: 'message' | 'system'
}

// ─── Sync ─────────────────────────────────────────────────────────────────────
export type SyncAction = 'play' | 'pause' | 'seek'

export interface SyncPayload {
  action: SyncAction
  time: number           // seconds
  issuerId: string
  issuedAt: number       // Date.now() at time of issue
}

// ─── WebRTC Signaling ─────────────────────────────────────────────────────────
export type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'peer-leave'

export interface SignalPayload {
  fromId: string
  toId: string
  type: SignalType
  data: RTCSessionDescriptionInit | RTCIceCandidateInit | null
}

// ─── Channel Events ───────────────────────────────────────────────────────────
export type ChannelEvent =
  | { kind: 'presence-sync';  presence: Record<string, PresenceInfo> }
  | { kind: 'presence-join';  participant: PresenceInfo }
  | { kind: 'presence-leave'; participantId: string }
  | { kind: 'chat';           message: ChatPayload }
  | { kind: 'sync';           event: SyncPayload }
  | { kind: 'signal';         signal: SignalPayload }

export type ChannelEventHandler = (event: ChannelEvent) => void

// ─── Adapter Interface ────────────────────────────────────────────────────────
export interface RoomChannelAdapter {
  /** Join the room and announce presence */
  join(info: PresenceInfo): Promise<void>
  /** Leave and clean up */
  leave(): void
  /** Update your own presence fields (mute, camera, etc.) */
  updatePresence(patch: Partial<PresenceInfo>): void
  /** Send a chat message */
  sendChat(msg: ChatPayload): void
  /** Send a playback sync event */
  sendSync(event: SyncPayload): void
  /** Send a WebRTC signaling message */
  sendSignal(signal: SignalPayload): void
  /** Register an event handler; returns unsubscribe */
  on(handler: ChannelEventHandler): () => void
  /** Current presence snapshot */
  getPresence(): Record<string, PresenceInfo>
  /** Whether the adapter is connected */
  readonly isConnected: boolean
}
