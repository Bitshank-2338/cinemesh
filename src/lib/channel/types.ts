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
export type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'peer-leave' | 'stream-roles'

/**
 * Stream-role mapping announcement. Tells peers which of the sender's
 * MediaStream IDs is the camera vs the screen share. Sent over the channel
 * any time the sender's local streams change so receivers can correctly
 * route incoming tracks to camera/screen UI slots.
 */
export interface StreamRolesPayload {
  cameraStreamId: string | null
  screenStreamId: string | null
}

export interface SignalPayload {
  fromId: string
  toId: string
  type: SignalType
  data:
    | RTCSessionDescriptionInit
    | RTCIceCandidateInit
    | StreamRolesPayload
    | null
}

// ─── Host moderation ──────────────────────────────────────────────────────────
export type ModerationAction =
  | 'kick'             // remove user from room
  | 'mute-mic'         // force-disable target's mic
  | 'stop-camera'      // force-disable target's camera
  | 'stop-screen'      // stop target's screen share

export interface ModerationPayload {
  targetId: string    // participantId of the user being moderated
  action:   ModerationAction
  issuerId: string    // participantId of the host issuing the command
  issuedAt: number
}

// ─── Channel Events ───────────────────────────────────────────────────────────
export type ChannelEvent =
  | { kind: 'presence-sync';  presence: Record<string, PresenceInfo> }
  | { kind: 'presence-join';  participant: PresenceInfo }
  | { kind: 'presence-leave'; participantId: string }
  | { kind: 'chat';           message: ChatPayload }
  | { kind: 'sync';           event: SyncPayload }
  | { kind: 'signal';         signal: SignalPayload }
  | { kind: 'moderation';     payload: ModerationPayload }

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
  /** Host-only: send a moderation command (kick / mute / stop share) */
  sendModeration(payload: ModerationPayload): void
  /** Register an event handler; returns unsubscribe */
  on(handler: ChannelEventHandler): () => void
  /** Current presence snapshot */
  getPresence(): Record<string, PresenceInfo>
  /** Whether the adapter is connected */
  readonly isConnected: boolean
}
