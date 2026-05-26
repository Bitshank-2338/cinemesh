'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WebRTCManager } from '@/lib/webrtc-manager'
import type { RoomChannelAdapter } from '@/lib/channel'

export type PeerConnectionState = RTCPeerConnectionState

export interface WebRTCState {
  remoteStreams:     Record<string, MediaStream>
  connectionStates:  Record<string, PeerConnectionState>
}

export function useWebRTC(
  myId:         string,
  myJoinedAt:   number,
  channel:      RoomChannelAdapter | null,
  localStream:  MediaStream | null,
  screenStream: MediaStream | null = null,
): WebRTCState {
  const [remoteStreams,    setRemoteStreams]    = useState<Record<string, MediaStream>>({})
  const [connectionStates, setConnectionStates] = useState<Record<string, PeerConnectionState>>({})

  const managerRef    = useRef<WebRTCManager | null>(null)
  const localRef      = useRef(localStream)
  const screenRef     = useRef(screenStream)
  localRef.current    = localStream
  screenRef.current   = screenStream

  // ── Create manager when channel becomes available ───────────────────────
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

  // ── Update camera tracks when local stream changes ────────────────────────
  useEffect(() => {
    if (screenRef.current) return  // screen share is active — don't clobber with camera
    managerRef.current?.updateLocalStream(localStream)
  }, [localStream])

  // ── Handle screen share: combine screen video + mic audio for peers ───────
  useEffect(() => {
    if (!managerRef.current) return

    if (screenStream) {
      // Build a combined stream: screen video track + mic audio track
      const combined = new MediaStream()
      screenStream.getVideoTracks().forEach(t => combined.addTrack(t))
      localRef.current?.getAudioTracks().forEach(t => combined.addTrack(t))
      managerRef.current.updateLocalStream(combined)
    } else {
      // Screen share stopped — restore camera stream
      managerRef.current.updateLocalStream(localRef.current)
    }
  }, [screenStream])

  return { remoteStreams, connectionStates }
}
