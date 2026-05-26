'use client'

import { useState, useEffect, useRef } from 'react'
import { WebRTCManager } from '@/lib/webrtc-manager'
import type { RoomChannelAdapter } from '@/lib/channel'

export type PeerConnectionState = RTCPeerConnectionState

export interface WebRTCState {
  /** Remote camera/voice streams (one per peer). */
  remoteCameras:    Record<string, MediaStream>
  /** Remote screen-share streams (only present while a peer shares). */
  remoteScreens:    Record<string, MediaStream>
  connectionStates: Record<string, PeerConnectionState>
}

export function useWebRTC(
  myId:         string,
  myJoinedAt:   number,
  channel:      RoomChannelAdapter | null,
  cameraStream: MediaStream | null,
  screenStream: MediaStream | null = null,
): WebRTCState {
  const [remoteCameras,    setRemoteCameras]    = useState<Record<string, MediaStream>>({})
  const [remoteScreens,    setRemoteScreens]    = useState<Record<string, MediaStream>>({})
  const [connectionStates, setConnectionStates] = useState<Record<string, PeerConnectionState>>({})
  const managerRef = useRef<WebRTCManager | null>(null)

  // Create/destroy manager when channel becomes available
  useEffect(() => {
    if (!channel) return

    const mgr = new WebRTCManager(myId, myJoinedAt, channel)

    mgr.setOnRemoteStream((peerId, slot, stream) => {
      const setter = slot === 'camera' ? setRemoteCameras : setRemoteScreens
      setter(prev => {
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

    mgr.start(cameraStream, screenStream)
    managerRef.current = mgr

    return () => {
      mgr.destroy()
      managerRef.current = null
      setRemoteCameras({})
      setRemoteScreens({})
      setConnectionStates({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, myId, myJoinedAt])

  // Push camera changes to manager
  useEffect(() => {
    managerRef.current?.setCameraStream(cameraStream)
  }, [cameraStream])

  // Push screen changes to manager
  useEffect(() => {
    managerRef.current?.setScreenStream(screenStream)
  }, [screenStream])

  return { remoteCameras, remoteScreens, connectionStates }
}
