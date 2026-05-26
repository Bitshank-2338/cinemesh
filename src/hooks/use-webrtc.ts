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
  myId:        string,
  myJoinedAt:  number,
  channel:     RoomChannelAdapter | null,
  localStream: MediaStream | null
): WebRTCState {
  const [remoteStreams,    setRemoteStreams]    = useState<Record<string, MediaStream>>({})
  const [connectionStates, setConnectionStates] = useState<Record<string, PeerConnectionState>>({})

  const managerRef = useRef<WebRTCManager | null>(null)

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

  // ── Update tracks when local stream changes ───────────────────────────────
  useEffect(() => {
    managerRef.current?.updateLocalStream(localStream)
  }, [localStream])

  return { remoteStreams, connectionStates }
}
