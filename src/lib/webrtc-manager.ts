/**
 * WebRTCManager — mesh of RTCPeerConnections with dual streams per peer.
 *
 * Each connection carries up to TWO logical streams simultaneously:
 *   1. camera   — webcam video + mic audio
 *   2. screen   — screen-share video + (optional) tab audio
 *
 * Local maintains stable MediaStream objects (this.cameraStream, this.screenStream)
 * so their .id values are stable across renegotiations. Whenever the local stream
 * configuration changes, we broadcast a `stream-roles` signal mapping our local
 * stream IDs to roles so peers can correctly classify incoming tracks.
 *
 * Glare prevention: higher joinedAt offers; ties broken lexicographically.
 */

import type {
  RoomChannelAdapter,
  PresenceInfo,
  SignalPayload,
  StreamRolesPayload,
} from './channel/types'

// ─── ICE ──────────────────────────────────────────────────────────────────────
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ]
  const turnUrl  = process.env.NEXT_PUBLIC_TURN_URL
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL
  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred })
  }
  return servers
}

export type StreamSlot = 'camera' | 'screen'
export type RemoteStreamHandler    = (peerId: string, slot: StreamSlot, stream: MediaStream | null) => void
export type ConnectionStateHandler = (peerId: string, state: RTCPeerConnectionState) => void

export class WebRTCManager {
  private peers = new Map<string, RTCPeerConnection>()

  /** Per-peer remote streams keyed by slot. */
  private remoteCameras = new Map<string, MediaStream>()
  private remoteScreens = new Map<string, MediaStream>()

  /** Latest known stream-role mapping for each peer (peerId -> roles). */
  private peerRoles = new Map<string, StreamRolesPayload>()

  /**
   * Unclassified tracks waiting for a stream-roles signal.
   * Keyed by peerId -> streamId -> MediaStream.
   * If a track arrives before its roles message, we stash it here.
   */
  private pendingTracks = new Map<string, Map<string, MediaStream>>()

  /**
   * Pending close timers. Supabase Realtime fires `leave` + `join` on every
   * presence track() update (e.g., mic toggle) — closing the peer immediately
   * would tear down WebRTC on every state change. We delay the close so a
   * quick re-join cancels it.
   */
  private pendingClose = new Map<string, ReturnType<typeof setTimeout>>()
  private static readonly CLOSE_GRACE_MS = 4000

  private unsubscribe: (() => void) | null = null

  /** Local streams (stable IDs so peers can match across renegotiations). */
  private cameraStream: MediaStream | null = null
  private screenStream: MediaStream | null = null

  private onRemoteStream:    RemoteStreamHandler    = () => {}
  private onConnectionState: ConnectionStateHandler = () => {}

  constructor(
    private myId:       string,
    private myJoinedAt: number,
    private channel:    RoomChannelAdapter,
  ) {}

  setOnRemoteStream(fn: RemoteStreamHandler):       void { this.onRemoteStream    = fn }
  setOnConnectionState(fn: ConnectionStateHandler): void { this.onConnectionState = fn }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  start(cameraStream: MediaStream | null, screenStream: MediaStream | null = null): void {
    this.cameraStream = cameraStream
    this.screenStream = screenStream

    this.unsubscribe = this.channel.on((event) => {
      if (event.kind === 'signal') this.handleSignal(event.signal)

      if (event.kind === 'presence-join') {
        // Re-join cancels any pending close from a recent leave
        this.cancelPendingClose(event.participant.participantId)
        this.onPeerJoined(event.participant)
      }

      if (event.kind === 'presence-sync') {
        // Anyone still in presence is NOT actually gone — cancel pending closes
        for (const p of Object.values(event.presence)) {
          if (p.participantId !== this.myId) this.cancelPendingClose(p.participantId)
        }
        this.onPresenceSync(event.presence)
      }

      if (event.kind === 'presence-leave') {
        this.schedulePendingClose(event.participantId)
      }
    })

    // Connect to any peers already present when we join
    const existing = this.channel.getPresence()
    for (const peer of Object.values(existing)) {
      if (peer.participantId !== this.myId) this.onPeerJoined(peer)
    }
  }

  destroy(): void {
    this.unsubscribe?.()
    // Cancel any pending close timers — closePeer below will tear everything down
    for (const t of this.pendingClose.values()) clearTimeout(t)
    this.pendingClose.clear()

    this.channel.sendSignal({
      fromId: this.myId,
      toId:   'all',
      type:   'peer-leave',
      data:   null,
    })
    for (const peerId of [...this.peers.keys()]) this.closePeer(peerId)
  }

  // ─── Stream updates ───────────────────────────────────────────────────────

  /** Update the local camera stream (camera + mic). */
  setCameraStream(stream: MediaStream | null): void {
    if (stream === this.cameraStream) return
    this.cameraStream = stream
    this.syncTracksToAllPeers()
    this.broadcastStreamRoles()
  }

  /** Update the local screen stream (screen video + optional system audio). */
  setScreenStream(stream: MediaStream | null): void {
    if (stream === this.screenStream) return
    this.screenStream = stream
    this.syncTracksToAllPeers()
    this.broadcastStreamRoles()
  }

  private broadcastStreamRoles(toPeer?: string): void {
    const payload: StreamRolesPayload = {
      cameraStreamId: this.cameraStream?.id ?? null,
      screenStreamId: this.screenStream?.id ?? null,
    }
    this.channel.sendSignal({
      fromId: this.myId,
      toId:   toPeer ?? 'all',
      type:   'stream-roles',
      data:   payload,
    })
  }

  /**
   * Make every peer connection's senders match our current local streams.
   * Adds new tracks, removes stale ones, replaces existing track contents.
   */
  private syncTracksToAllPeers(): void {
    for (const [, pc] of this.peers) {
      this.syncTracksToPeer(pc)
    }
    this.applyBitrateProfile()
  }

  /**
   * Cap outgoing video bitrate based on peer count. WebRTC mesh sends N-1
   * copies of each track, so total upload scales linearly with room size.
   * Without this, a 10-person room would saturate most home uplinks and
   * trigger packet loss / "Reconnecting" warnings.
   *
   * Camera profile (per peer):    1 Mbps  →  500k  →  250k  →  150k
   * Screen profile (per peer):    2.5 Mbps→ 1.5M  →  1 Mbps→  800k
   *
   * Re-applied every time the peer set or local streams change.
   */
  private applyBitrateProfile(): void {
    const peerCount = this.peers.size
    const camBps = peerCount <= 3 ? 1_000_000
                 : peerCount <= 7 ?   500_000
                 : peerCount <= 13?   250_000
                 :                    150_000
    const scrBps = peerCount <= 3 ? 2_500_000
                 : peerCount <= 7 ? 1_500_000
                 : peerCount <= 13? 1_000_000
                 :                    800_000

    for (const pc of this.peers.values()) {
      if (pc.signalingState === 'closed') continue
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind !== 'video') continue
        // Distinguish camera vs screen by which local stream the track belongs to
        const isScreen = !!this.screenStream?.getTracks().includes(sender.track)
        const maxBitrate = isScreen ? scrBps : camBps
        try {
          const params = sender.getParameters()
          if (!params.encodings || params.encodings.length === 0) {
            // setParameters requires at least one encoding entry
            params.encodings = [{}]
          }
          params.encodings[0].maxBitrate = maxBitrate
          // Prefer maintaining framerate when bandwidth gets tight (smoother for movies)
          params.degradationPreference = isScreen ? 'maintain-framerate' : 'balanced'
          sender.setParameters(params).catch(() => {/* closing pc */})
        } catch { /* ignore */ }
      }
    }
  }

  private syncTracksToPeer(pc: RTCPeerConnection): void {
    if (pc.signalingState === 'closed') return

    const desired: Array<{ track: MediaStreamTrack; stream: MediaStream }> = []
    if (this.cameraStream) {
      for (const t of this.cameraStream.getTracks()) desired.push({ track: t, stream: this.cameraStream })
    }
    if (this.screenStream) {
      for (const t of this.screenStream.getTracks()) desired.push({ track: t, stream: this.screenStream })
    }

    const senders = pc.getSenders()
    const usedSenders = new Set<RTCRtpSender>()

    // Match each desired track to an existing sender of the same kind
    // belonging to the same stream, or replace/add as needed.
    for (const { track, stream } of desired) {
      let sender = senders.find(s =>
        !usedSenders.has(s) &&
        s.track?.kind === track.kind &&
        // Prefer the sender already carrying a track of this stream
        s.track === track,
      )
      if (!sender) {
        // Fallback: any sender of same kind we haven't used yet
        sender = senders.find(s => !usedSenders.has(s) && s.track?.kind === track.kind)
      }
      if (sender) {
        if (sender.track !== track) {
          sender.replaceTrack(track).catch(() => {/* ignore on closing */})
        }
        usedSenders.add(sender)
      } else {
        // Need to add a NEW sender
        try {
          pc.addTrack(track, stream)
        } catch { /* track already added on another tx; ignore */ }
      }
    }

    // Remove senders we no longer need (e.g., screen share ended → screen tracks gone)
    for (const s of senders) {
      if (!usedSenders.has(s) && s.track) {
        try { pc.removeTrack(s) } catch { /* ignore */ }
      }
    }
  }

  // ─── Presence ─────────────────────────────────────────────────────────────

  private onPeerJoined(peer: PresenceInfo): void {
    if (peer.participantId === this.myId) return
    if (this.peers.has(peer.participantId)) return

    const iShouldOffer =
      this.myJoinedAt > peer.joinedAt ||
      (this.myJoinedAt === peer.joinedAt && this.myId > peer.participantId)

    if (iShouldOffer) {
      this.createPeerAndOffer(peer.participantId)
    }
  }

  private onPresenceSync(presence: Record<string, PresenceInfo>): void {
    for (const peer of Object.values(presence)) {
      if (peer.participantId !== this.myId && !this.peers.has(peer.participantId)) {
        this.onPeerJoined(peer)
      }
    }
  }

  // ─── Signaling ────────────────────────────────────────────────────────────

  private async createPeerAndOffer(peerId: string): Promise<void> {
    const pc = this.createPeerConnection(peerId)
    this.syncTracksToPeer(pc)
    this.applyBitrateProfile()

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      this.channel.sendSignal({
        fromId: this.myId,
        toId:   peerId,
        type:   'offer',
        data:   pc.localDescription!.toJSON(),
      })
      // Tell the new peer what our stream roles look like
      this.broadcastStreamRoles(peerId)
    } catch (err) {
      console.warn('[WebRTC] createOffer failed', err)
    }
  }

  private async handleSignal(signal: SignalPayload): Promise<void> {
    // Stream-role announcements may be broadcast to "all" — accept those too
    const forUs = signal.toId === this.myId || signal.toId === 'all'
    if (!forUs) return

    const { fromId } = signal

    switch (signal.type) {
      case 'offer': {
        let pc = this.peers.get(fromId)
        if (!pc) {
          pc = this.createPeerConnection(fromId)
          this.syncTracksToPeer(pc)
          this.applyBitrateProfile()
        }
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription(signal.data as RTCSessionDescriptionInit),
          )
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          this.channel.sendSignal({
            fromId: this.myId,
            toId:   fromId,
            type:   'answer',
            data:   pc.localDescription!.toJSON(),
          })
          this.broadcastStreamRoles(fromId)
        } catch (err) {
          console.warn('[WebRTC] handle offer failed', err)
        }
        break
      }

      case 'answer': {
        const pc = this.peers.get(fromId)
        if (!pc) return
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signal.data as RTCSessionDescriptionInit),
            )
          }
        } catch (err) {
          console.warn('[WebRTC] handle answer failed', err)
        }
        break
      }

      case 'ice-candidate': {
        const pc = this.peers.get(fromId)
        if (!pc || !signal.data) return
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.data as RTCIceCandidateInit))
        } catch { /* benign */ }
        break
      }

      case 'stream-roles': {
        const roles = signal.data as StreamRolesPayload
        this.peerRoles.set(fromId, roles)
        this.reclassifyPendingTracks(fromId)
        // Also re-route any already-emitted streams that should now move slots
        this.applyRolesToExistingStreams(fromId)
        break
      }

      case 'peer-leave':
        this.closePeer(fromId)
        break
    }
  }

  // ─── Classification of remote tracks ──────────────────────────────────────

  private classifyStream(peerId: string, streamId: string): StreamSlot | null {
    const roles = this.peerRoles.get(peerId)
    if (!roles) return null
    if (roles.screenStreamId === streamId) return 'screen'
    if (roles.cameraStreamId === streamId) return 'camera'
    return null
  }

  private reclassifyPendingTracks(peerId: string): void {
    const pending = this.pendingTracks.get(peerId)
    if (!pending) return
    for (const [streamId, stream] of pending) {
      const slot = this.classifyStream(peerId, streamId)
      if (slot) {
        this.assignStreamToSlot(peerId, slot, stream)
        pending.delete(streamId)
      }
    }
    if (pending.size === 0) this.pendingTracks.delete(peerId)
  }

  /** If an already-assigned stream now matches a different slot per new roles, move it. */
  private applyRolesToExistingStreams(peerId: string): void {
    const cam = this.remoteCameras.get(peerId)
    const scr = this.remoteScreens.get(peerId)
    const roles = this.peerRoles.get(peerId)
    if (!roles) return

    // If the screen role was cleared, clear the local mapping too
    if (!roles.screenStreamId && scr) {
      this.remoteScreens.delete(peerId)
      this.onRemoteStream(peerId, 'screen', null)
    }
    // If a known camera stream is now declared the screen (rare, but be robust)
    if (cam && roles.screenStreamId === cam.id) {
      this.remoteCameras.delete(peerId)
      this.assignStreamToSlot(peerId, 'screen', cam)
    }
  }

  private assignStreamToSlot(peerId: string, slot: StreamSlot, stream: MediaStream): void {
    if (slot === 'camera') {
      this.remoteCameras.set(peerId, stream)
    } else {
      this.remoteScreens.set(peerId, stream)
    }
    this.onRemoteStream(peerId, slot, stream)
  }

  // ─── Peer connection factory ──────────────────────────────────────────────

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() })
    this.peers.set(peerId, pc)

    pc.ontrack = (ev) => {
      const stream = ev.streams[0]
      if (!stream) return

      const slot = this.classifyStream(peerId, stream.id)
      if (slot) {
        this.assignStreamToSlot(peerId, slot, stream)
      } else {
        // Roles not announced yet — buffer the stream and classify when roles arrive
        let pending = this.pendingTracks.get(peerId)
        if (!pending) {
          pending = new Map()
          this.pendingTracks.set(peerId, pending)
        }
        pending.set(stream.id, stream)
        // Fallback: also emit as camera so SOMETHING shows up until roles confirm.
        // Most common case (no screen share active) means this stream IS the camera.
        if (!this.remoteCameras.has(peerId)) {
          this.assignStreamToSlot(peerId, 'camera', stream)
        }
      }

      // If the track ends remotely, remove it from the displayed stream
      ev.track.onended = () => {
        if (this.remoteCameras.get(peerId) === stream) {
          stream.removeTrack(ev.track)
          if (stream.getTracks().length === 0) {
            this.remoteCameras.delete(peerId)
            this.onRemoteStream(peerId, 'camera', null)
          }
        } else if (this.remoteScreens.get(peerId) === stream) {
          stream.removeTrack(ev.track)
          if (stream.getTracks().length === 0) {
            this.remoteScreens.delete(peerId)
            this.onRemoteStream(peerId, 'screen', null)
          }
        }
      }
    }

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return
      this.channel.sendSignal({
        fromId: this.myId,
        toId:   peerId,
        type:   'ice-candidate',
        data:   candidate.toJSON(),
      })
    }

    pc.onconnectionstatechange = () => {
      this.onConnectionState(peerId, pc.connectionState)
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.onRemoteStream(peerId, 'camera', null)
        this.onRemoteStream(peerId, 'screen', null)
      }
    }

    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== 'stable') return
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        this.channel.sendSignal({
          fromId: this.myId,
          toId:   peerId,
          type:   'offer',
          data:   pc.localDescription!.toJSON(),
        })
        // Renegotiation may signal new streams — send fresh roles
        this.broadcastStreamRoles(peerId)
      } catch { /* ignore */ }
    }

    return pc
  }

  /**
   * Schedule a peer to be closed in CLOSE_GRACE_MS. Supabase Realtime emits
   * spurious presence-leave events when a peer just updates their state
   * (mic/cam toggle); a quick presence-sync or presence-join arriving within
   * the grace window cancels the close.
   */
  private schedulePendingClose(peerId: string): void {
    if (this.pendingClose.has(peerId)) return  // already scheduled
    const timer = setTimeout(() => {
      this.pendingClose.delete(peerId)
      // Final verification — is the peer truly gone from current presence?
      const current = this.channel.getPresence()
      if (!current[peerId]) {
        this.closePeer(peerId)
      }
    }, WebRTCManager.CLOSE_GRACE_MS)
    this.pendingClose.set(peerId, timer)
  }

  private cancelPendingClose(peerId: string): void {
    const timer = this.pendingClose.get(peerId)
    if (timer != null) {
      clearTimeout(timer)
      this.pendingClose.delete(peerId)
    }
  }

  private closePeer(peerId: string): void {
    this.cancelPendingClose(peerId)
    const pc = this.peers.get(peerId)
    if (pc) {
      pc.ontrack = null
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.onnegotiationneeded = null
      pc.close()
      this.peers.delete(peerId)
    }
    this.remoteCameras.delete(peerId)
    this.remoteScreens.delete(peerId)
    this.peerRoles.delete(peerId)
    this.pendingTracks.delete(peerId)
    this.onRemoteStream(peerId, 'camera', null)
    this.onRemoteStream(peerId, 'screen', null)

    // Room is smaller now — bump quality back up for remaining peers
    this.applyBitrateProfile()
  }
}
