/**
 * WebRTCManager — manages a mesh of RTCPeerConnections.
 *
 * Each participant has a direct P2P connection with every other participant.
 * Uses the RoomChannelAdapter for signaling (offer/answer/ICE).
 *
 * Negotiation rule (avoids glare):
 *   The participant with the LARGER joinedAt timestamp sends the offer.
 *   If joinedAt is identical, the LARGER participantId (lexicographic) offers.
 */

import type { RoomChannelAdapter, PresenceInfo, SignalPayload } from './channel/types'

// ─── ICE Configuration ────────────────────────────────────────────────────────
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ]

  // Optional TURN server from env
  const turnUrl  = process.env.NEXT_PUBLIC_TURN_URL
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL
  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred })
  }

  return servers
}

export type RemoteStreamHandler = (peerId: string, stream: MediaStream | null) => void
export type ConnectionStateHandler = (peerId: string, state: RTCPeerConnectionState) => void

export class WebRTCManager {
  private peers = new Map<string, RTCPeerConnection>()
  private remoteStreams = new Map<string, MediaStream>()
  private unsubscribe: (() => void) | null = null

  private onRemoteStream: RemoteStreamHandler = () => {}
  private onConnectionState: ConnectionStateHandler = () => {}

  constructor(
    private myId: string,
    private myJoinedAt: number,
    private channel: RoomChannelAdapter
  ) {}

  setOnRemoteStream(fn: RemoteStreamHandler):  void { this.onRemoteStream   = fn }
  setOnConnectionState(fn: ConnectionStateHandler): void { this.onConnectionState = fn }

  /** Start listening for signals. Call this once after channel.join(). */
  start(localStream: MediaStream | null): void {
    this.unsubscribe = this.channel.on((event) => {
      if (event.kind === 'signal') this.handleSignal(event.signal, localStream)
      if (event.kind === 'presence-join') this.onPeerJoined(event.participant, localStream)
      if (event.kind === 'presence-leave') this.closePeer(event.participantId)
    })
  }

  /** Call when local stream changes (e.g. camera toggled). */
  updateLocalStream(stream: MediaStream | null): void {
    for (const [peerId, pc] of this.peers) {
      const senders = pc.getSenders()
      if (!stream) {
        senders.forEach(s => s.track && pc.removeTrack(s))
        return
      }
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]

      const videoSender = senders.find(s => s.track?.kind === 'video')
      const audioSender = senders.find(s => s.track?.kind === 'audio')

      try {
        if (videoTrack && videoSender) {
          videoSender.replaceTrack(videoTrack).catch(() => {/* ignore — peer may be closing */})
        } else if (videoTrack) {
          pc.addTrack(videoTrack, stream)
          this.renegotiate(peerId, pc, stream)
        }

        if (audioTrack && audioSender) {
          audioSender.replaceTrack(audioTrack).catch(() => {})
        } else if (audioTrack) {
          pc.addTrack(audioTrack, stream)
        }
      } catch { /* ignore on closed connections */ }
    }
  }

  /** Initiate connection to a newly joined peer (if we should offer) */
  private onPeerJoined(peer: PresenceInfo, localStream: MediaStream | null): void {
    if (peer.participantId === this.myId) return
    if (this.peers.has(peer.participantId)) return

    // Only the "later" joiner offers (to avoid glare)
    const iShouldOffer = this.myJoinedAt > peer.joinedAt ||
      (this.myJoinedAt === peer.joinedAt && this.myId > peer.participantId)

    if (iShouldOffer) {
      this.createPeerAndOffer(peer.participantId, localStream)
    }
    // else: wait for their offer
  }

  private async createPeerAndOffer(
    peerId: string,
    localStream: MediaStream | null
  ): Promise<void> {
    const pc = this.createPeerConnection(peerId)

    if (localStream) {
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream))
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

  private async handleSignal(
    signal: SignalPayload,
    localStream: MediaStream | null
  ): Promise<void> {
    // Ignore signals not addressed to us
    if (signal.toId !== this.myId) return

    const { fromId } = signal

    switch (signal.type) {
      case 'offer': {
        let pc = this.peers.get(fromId)
        if (!pc) {
          pc = this.createPeerConnection(fromId)
          if (localStream) {
            localStream.getTracks().forEach(t => pc!.addTrack(t, localStream))
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
        } catch { /* ignore benign ICE errors */ }
        break
      }

      case 'peer-leave': {
        this.closePeer(fromId)
        break
      }
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() })
    this.peers.set(peerId, pc)

    // Collect remote tracks into a stream
    const remoteStream = new MediaStream()
    this.remoteStreams.set(peerId, remoteStream)

    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach(t => {
        // Replace existing track of same kind to avoid duplicates
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

    // Handle negotiation needed (for renegotiation after track changes)
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

  private async renegotiate(
    peerId: string,
    pc: RTCPeerConnection,
    _stream: MediaStream
  ): Promise<void> {
    if (pc.signalingState !== 'stable') return
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      this.channel.sendSignal({
        fromId: this.myId,
        toId: peerId,
        type: 'offer',
        data: pc.localDescription!.toJSON(),
      })
    } catch { /* ignore */ }
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

  /** Clean up everything */
  destroy(): void {
    this.unsubscribe?.()
    // Signal peers we're leaving
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
