/**
 * WebRTCManager — mesh of RTCPeerConnections.
 *
 * Key design decisions:
 *
 * 1. currentStream (not a closure) — always tracks the latest local
 *    stream so new peers and screen-share replacements all get the
 *    right tracks.
 *
 * 2. presence-sync handled on start() — when we join a channel where
 *    peers are ALREADY present, we connect to them immediately instead
 *    of missing them because they arrived before our handler registered.
 *
 * 3. Glare prevention — higher joinedAt sends the offer; ties broken by
 *    lexicographic participantId.
 */

import type { RoomChannelAdapter, PresenceInfo, SignalPayload } from './channel/types'

// ─── ICE configuration ────────────────────────────────────────────────────────
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

export type RemoteStreamHandler    = (peerId: string, stream: MediaStream | null) => void
export type ConnectionStateHandler = (peerId: string, state: RTCPeerConnectionState) => void

export class WebRTCManager {
  private peers         = new Map<string, RTCPeerConnection>()
  private remoteStreams = new Map<string, MediaStream>()
  private unsubscribe:  (() => void) | null = null

  /** Always holds the currently-active local stream (camera OR screen+mic). */
  private currentStream: MediaStream | null = null

  private onRemoteStream:    RemoteStreamHandler    = () => {}
  private onConnectionState: ConnectionStateHandler = () => {}

  constructor(
    private myId:       string,
    private myJoinedAt: number,
    private channel:    RoomChannelAdapter,
  ) {}

  setOnRemoteStream(fn: RemoteStreamHandler):        void { this.onRemoteStream    = fn }
  setOnConnectionState(fn: ConnectionStateHandler):  void { this.onConnectionState = fn }

  /**
   * Begin listening for signals and presence events.
   * Also immediately connects to any peers already in the channel
   * (they arrived before our handler registered, so we'd miss presence-join).
   */
  start(localStream: MediaStream | null): void {
    this.currentStream = localStream

    this.unsubscribe = this.channel.on((event) => {
      if (event.kind === 'signal')        this.handleSignal(event.signal)
      if (event.kind === 'presence-join') this.onPeerJoined(event.participant)
      if (event.kind === 'presence-sync') this.onPresenceSync(event.presence)
      if (event.kind === 'presence-leave') this.closePeer(event.participantId)
    })

    // ← connect to peers already present when we join
    const existing = this.channel.getPresence()
    for (const peer of Object.values(existing)) {
      if (peer.participantId !== this.myId) {
        this.onPeerJoined(peer)
      }
    }
  }

  /**
   * Call whenever the local stream changes (camera on/off, screen share start/stop).
   * Replaces tracks in all existing peer connections; new connections always use
   * this.currentStream so screen share is included automatically.
   */
  updateLocalStream(stream: MediaStream | null): void {
    this.currentStream = stream

    for (const [peerId, pc] of this.peers) {
      if (!stream) {
        pc.getSenders().forEach(s => s.track && pc.removeTrack(s))
        continue
      }

      const senders    = pc.getSenders()
      const videoTrack = stream.getVideoTracks()[0] ?? null
      const audioTrack = stream.getAudioTracks()[0] ?? null

      const videoSender = senders.find(s => s.track?.kind === 'video') ?? null
      const audioSender = senders.find(s => s.track?.kind === 'audio') ?? null

      try {
        if (videoTrack && videoSender) {
          videoSender.replaceTrack(videoTrack).catch(() => {})
        } else if (videoTrack && !videoSender) {
          pc.addTrack(videoTrack, stream)
          // onnegotiationneeded will handle re-offer automatically
        }

        if (audioTrack && audioSender) {
          audioSender.replaceTrack(audioTrack).catch(() => {})
        } else if (audioTrack && !audioSender) {
          pc.addTrack(audioTrack, stream)
        }
      } catch { /* ignore on closing connections */ }

      void peerId // suppress unused-var lint
    }
  }

  // ─── Presence ─────────────────────────────────────────────────────────────

  /** Handle presence-join (new peer arrived after us). */
  private onPeerJoined(peer: PresenceInfo): void {
    if (peer.participantId === this.myId)          return
    if (this.peers.has(peer.participantId))         return

    const iShouldOffer =
      this.myJoinedAt > peer.joinedAt ||
      (this.myJoinedAt === peer.joinedAt && this.myId > peer.participantId)

    if (iShouldOffer) {
      this.createPeerAndOffer(peer.participantId)
    }
    // else: wait — they will send the offer
  }

  /** Handle presence-sync (full snapshot, fires on join and re-connects). */
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

    if (this.currentStream) {
      this.currentStream.getTracks().forEach(t => pc.addTrack(t, this.currentStream!))
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      this.channel.sendSignal({
        fromId: this.myId,
        toId:   peerId,
        type:   'offer',
        data:   pc.localDescription!.toJSON(),
      })
    } catch (err) {
      console.warn('[WebRTC] createOffer failed', err)
    }
  }

  private async handleSignal(signal: SignalPayload): Promise<void> {
    if (signal.toId !== this.myId) return

    const { fromId } = signal

    switch (signal.type) {
      case 'offer': {
        let pc = this.peers.get(fromId)
        if (!pc) {
          pc = this.createPeerConnection(fromId)
          if (this.currentStream) {
            this.currentStream.getTracks().forEach(t => pc!.addTrack(t, this.currentStream!))
          }
        }
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
          )
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          this.channel.sendSignal({
            fromId: this.myId,
            toId:   fromId,
            type:   'answer',
            data:   pc.localDescription!.toJSON(),
          })
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
              new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
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
        } catch { /* benign ICE errors */ }
        break
      }

      case 'peer-leave':
        this.closePeer(fromId)
        break
    }
  }

  // ─── Peer connection factory ──────────────────────────────────────────────

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() })
    this.peers.set(peerId, pc)

    const remoteStream = new MediaStream()
    this.remoteStreams.set(peerId, remoteStream)

    pc.ontrack = (ev) => {
      const tracks = ev.streams[0]?.getTracks() ?? [ev.track]
      tracks.forEach(t => {
        const existing = remoteStream.getTracks().find(x => x.kind === t.kind)
        if (existing) remoteStream.removeTrack(existing)
        remoteStream.addTrack(t)
      })
      this.onRemoteStream(peerId, remoteStream)
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
        this.onRemoteStream(peerId, null)
      }
    }

    // Renegotiation (e.g. after addTrack when stream wasn't ready at offer time)
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
      } catch { /* ignore */ }
    }

    return pc
  }

  private closePeer(peerId: string): void {
    const pc = this.peers.get(peerId)
    if (pc) {
      pc.ontrack = null
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.onnegotiationneeded = null
      pc.close()
      this.peers.delete(peerId)
    }
    this.remoteStreams.delete(peerId)
    this.onRemoteStream(peerId, null)
  }

  getRemoteStream(peerId: string): MediaStream | null {
    return this.remoteStreams.get(peerId) ?? null
  }

  destroy(): void {
    this.unsubscribe?.()
    this.channel.sendSignal({
      fromId: this.myId,
      toId:   'all',
      type:   'peer-leave',
      data:   null,
    })
    for (const peerId of [...this.peers.keys()]) {
      this.closePeer(peerId)
    }
  }
}
