'use client'

import { useState, useEffect, useRef } from 'react'
import { WebRTCManager } from '@/lib/webrtc-manager'
import type { RoomChannelAdapter } from '@/lib/channel'

export type PeerConnectionState = RTCPeerConnectionState

export interface WebRTCState {
  remoteStreams:    Record<string, MediaStream>
  connectionStates: Record<string, PeerConnectionState>
}

export function useWebRTC(
  myId:         string,
  myJoinedAt:   number,
  channel:      RoomChannelAdapter | null,
  localStream:  MediaStream | null,
  screenStream: MediaStream | null = null,
): WebRTCState {
  const [remoteStreams,     setRemoteStreams]     = useState<Record<string, MediaStream>>({})
  const [connectionStates,  setConnectionStates]  = useState<Record<string, PeerConnectionState>>({})
  const managerRef = useRef<WebRTCManager | null>(null)

  // ── Create / destroy manager when channel is available ───────────────────
  useEffect(() => {
    if (!channel) return

    const mgr = new WebRTCManager(myId, myJoinedAt, channel)

    mgr.setOnRemoteStream((peerId, stream) => {
      setRemoteStreams(prev => {
        if (!stream) {
          const next = { ...prev }
          delete next[peerId]
          return next
        }
        return { ...prev, [peerId]: stream }
      })
    })

    mgr.setOnConnectionState((peerId, state) => {
      setConnectionStates(prev => ({ ...prev, [peerId]: state }))
    })

    // start() also connects to peers already present in the channel
    mgr.start(localStream)
    managerRef.current = mgr

    return () => {
      mgr.destroy()
      managerRef.current = null
      setRemoteStreams({})
      setConnectionStates({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, myId, myJoinedAt])

  // ── Push camera stream changes to manager ────────────────────────────────
  useEffect(() => {
    // Don't clobber with camera while screen sharing
    if (screenStream) return
    managerRef.current?.updateLocalStream(localStream)
  }, [localStream, screenStream])

  // ── Handle screen share: screen video + mic audio ────────────────────────
  useEffect(() => {
    if (!managerRef.current) return

    if (screenStream) {
      // Combine: screen video track + microphone audio track
      const combined = new MediaStream()
      screenStream.getVideoTracks().forEach(t => combined.addTrack(t))
      localStream?.getAudioTracks().forEach(t => combined.addTrack(t))
      managerRef.current.updateLocalStream(combined)
    } else {
      // Screen share stopped — restore camera
      managerRef.current.updateLocalStream(localStream)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenStream])

  return { remoteStreams, connectionStates }
}
