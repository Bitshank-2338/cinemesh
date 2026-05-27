'use client'

/**
 * useLiveKitRoom — drop-in SFU replacement for the WebRTC mesh hook.
 *
 * Connects to a LiveKit Cloud SFU, publishes local camera + mic + screen,
 * and exposes the same `remoteCameras` / `remoteScreens` / `connectionStates`
 * shape as `useWebRTC` so the room page UI doesn't need to know which
 * transport is in use.
 *
 * Mesh limit  ~8 people (each peer uploads N-1 copies).
 * SFU limit   100+ people (each peer uploads ONCE; SFU forwards).
 *
 * Falls back to no-op if LiveKit isn't configured (env var missing).
 */

import { useState, useEffect, useRef } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  ConnectionState,
  LocalParticipant,
} from 'livekit-client'

export type LkConnState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface LiveKitRoomState {
  remoteCameras:    Record<string, MediaStream>
  remoteScreens:    Record<string, MediaStream>
  connectionStates: Record<string, RTCPeerConnectionState>
  /** Overall connection to the SFU itself. */
  connectionState:  LkConnState
  /** True once we successfully joined and have a Room instance. */
  connected:        boolean
  /** True if LiveKit env vars are configured and the route returned a token. */
  enabled:          boolean
  /** Underlying Room — exposed for moderation calls (kick/mute via roomAdmin). */
  room:             Room | null
}

/**
 * Strip BOM and surrounding quotes from env values — same defense as in
 * supabase.ts. When env vars are set via `cmd /c type | vercel env add`,
 * Vercel sometimes wraps the value in quotes, which would break the WS URL.
 */
function cleanEnv(v: string | undefined): string {
  if (!v) return ''
  return v.replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim()
}

export const getLiveKitUrl = (): string =>
  cleanEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL)

export const isLiveKitConfigured = (): boolean =>
  typeof window !== 'undefined' && getLiveKitUrl().startsWith('wss://')

interface UseLiveKitOpts {
  /** Room code (URL identifier — used as LiveKit room name) */
  roomId:        string | null
  identity:      string
  displayName:   string
  isHost:        boolean
  cameraStream:  MediaStream | null
  screenStream:  MediaStream | null
}

export function useLiveKitRoom(opts: UseLiveKitOpts): LiveKitRoomState {
  const { roomId, identity, displayName, isHost, cameraStream, screenStream } = opts

  const [remoteCameras,    setRemoteCameras]    = useState<Record<string, MediaStream>>({})
  const [remoteScreens,    setRemoteScreens]    = useState<Record<string, MediaStream>>({})
  const [connectionStates, setConnectionStates] = useState<Record<string, RTCPeerConnectionState>>({})
  const [connectionState,  setConnectionState]  = useState<LkConnState>('idle')
  const [room,             setRoom]             = useState<Room | null>(null)

  const enabled = isLiveKitConfigured() && !!roomId

  // Stable refs so we can manage tracks without re-running the big connect effect
  const roomRef         = useRef<Room | null>(null)
  const camStreamRef    = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  camStreamRef.current    = cameraStream
  screenStreamRef.current = screenStream

  // ── Connect to LiveKit ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) { setConnectionState('idle'); return }

    let cancelled = false
    const lkRoom  = new Room({
      adaptiveStream: true,
      dynacast:       true,
      publishDefaults: {
        // Reasonable defaults — SFU forwards as-is, so let LiveKit pick
        videoCodec: 'vp8',
      },
    })

    const onCamPub  = (participant: RemoteParticipant, slot: 'camera' | 'screen', stream: MediaStream | null) => {
      const setter = slot === 'camera' ? setRemoteCameras : setRemoteScreens
      setter(prev => {
        if (!stream) {
          const next = { ...prev }
          delete next[participant.identity]
          return next
        }
        return { ...prev, [participant.identity]: stream }
      })
    }

    const trackToStream = (track: RemoteTrack): MediaStream => {
      const s = new MediaStream()
      if (track.mediaStreamTrack) s.addTrack(track.mediaStreamTrack)
      return s
    }

    lkRoom
      .on(RoomEvent.TrackSubscribed, (track, publication, participant: RemoteParticipant) => {
        // Classify by Track.Source
        const source = publication.source
        if (source === Track.Source.Camera || source === Track.Source.Microphone) {
          // Maintain a per-participant camera stream with both audio+video
          setRemoteCameras(prev => {
            const existing = prev[participant.identity] ?? new MediaStream()
            // Remove any old track of same kind and add the new one
            for (const t of existing.getTracks()) {
              if (t.kind === track.mediaStreamTrack.kind) existing.removeTrack(t)
            }
            existing.addTrack(track.mediaStreamTrack)
            return { ...prev, [participant.identity]: existing }
          })
        } else if (source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio) {
          setRemoteScreens(prev => {
            const existing = prev[participant.identity] ?? new MediaStream()
            for (const t of existing.getTracks()) {
              if (t.kind === track.mediaStreamTrack.kind) existing.removeTrack(t)
            }
            existing.addTrack(track.mediaStreamTrack)
            return { ...prev, [participant.identity]: existing }
          })
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        const source = publication.source
        const targetMap = (source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio)
          ? 'screen' : 'camera'
        const setter = targetMap === 'screen' ? setRemoteScreens : setRemoteCameras
        setter(prev => {
          const existing = prev[participant.identity]
          if (!existing) return prev
          try { existing.removeTrack(track.mediaStreamTrack) } catch {}
          if (existing.getTracks().length === 0) {
            const next = { ...prev }
            delete next[participant.identity]
            return next
          }
          return { ...prev, [participant.identity]: existing }
        })
      })
      .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        onCamPub(participant, 'camera', null)
        onCamPub(participant, 'screen', null)
        setConnectionStates(prev => {
          const next = { ...prev }
          delete next[participant.identity]
          return next
        })
      })
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        const map: Record<ConnectionState, LkConnState> = {
          [ConnectionState.Disconnected]:  'disconnected',
          [ConnectionState.Connecting]:    'connecting',
          [ConnectionState.Connected]:     'connected',
          [ConnectionState.Reconnecting]:  'reconnecting',
          [ConnectionState.SignalReconnecting]: 'reconnecting',
        }
        setConnectionState(map[state] ?? 'idle')
      })
      .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        setConnectionStates(prev => ({ ...prev, [participant.identity]: 'connected' }))
      })

    ;(async () => {
      try {
        // Fetch a JWT for this identity + room from our /api route
        setConnectionState('connecting')
        const params = new URLSearchParams({
          room: roomId!,
          identity,
          name: displayName,
          isHost: String(isHost),
        })
        const res = await fetch(`/api/livekit-token?${params.toString()}`)
        if (!res.ok) {
          console.warn('[LiveKit] token fetch failed', res.status)
          setConnectionState('disconnected')
          return
        }
        const { token } = await res.json()
        if (cancelled) return

        const url = getLiveKitUrl()
        await lkRoom.connect(url, token, { autoSubscribe: true })
        if (cancelled) { lkRoom.disconnect(); return }

        // Publish existing local tracks if any
        const cs = camStreamRef.current
        if (cs) {
          for (const t of cs.getTracks()) {
            await lkRoom.localParticipant.publishTrack(t, {
              source: t.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone,
            })
          }
        }
        const ss = screenStreamRef.current
        if (ss) {
          for (const t of ss.getTracks()) {
            await lkRoom.localParticipant.publishTrack(t, {
              source: t.kind === 'video' ? Track.Source.ScreenShare : Track.Source.ScreenShareAudio,
            })
          }
        }

        roomRef.current = lkRoom
        setRoom(lkRoom)
      } catch (err) {
        console.warn('[LiveKit] connect failed', err)
        setConnectionState('disconnected')
      }
    })()

    return () => {
      cancelled = true
      try { lkRoom.disconnect() } catch {}
      roomRef.current = null
      setRoom(null)
      setRemoteCameras({})
      setRemoteScreens({})
      setConnectionStates({})
      setConnectionState('disconnected')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId, identity])

  // ── Push camera track changes ───────────────────────────────────────────
  useEffect(() => {
    const lk = roomRef.current
    if (!lk || !lk.localParticipant) return
    syncTracks(lk.localParticipant, cameraStream, Track.Source.Camera, Track.Source.Microphone)
  }, [cameraStream])

  // ── Push screen track changes ───────────────────────────────────────────
  useEffect(() => {
    const lk = roomRef.current
    if (!lk || !lk.localParticipant) return
    syncTracks(lk.localParticipant, screenStream, Track.Source.ScreenShare, Track.Source.ScreenShareAudio)
  }, [screenStream])

  return {
    remoteCameras,
    remoteScreens,
    connectionStates,
    connectionState,
    connected: connectionState === 'connected',
    enabled,
    room,
  }
}

/**
 * Reconcile published tracks of a given source pair against a desired stream.
 * - If stream is null/empty: unpublish everything in those slots.
 * - If new tracks present: publish them.
 * - Idempotent — safe to call repeatedly with the same stream.
 */
async function syncTracks(
  lp:          LocalParticipant,
  stream:      MediaStream | null,
  videoSource: Track.Source,
  audioSource: Track.Source,
): Promise<void> {
  // Unpublish anything not in the new stream
  const sources = [videoSource, audioSource]
  for (const src of sources) {
    const pub = lp.getTrackPublication(src)
    if (!pub) continue
    const stillPresent =
      stream &&
      stream.getTracks().some(t => t === pub.track?.mediaStreamTrack)
    if (!stillPresent) {
      try { await lp.unpublishTrack(pub.track!.mediaStreamTrack, true) } catch {}
    }
  }
  if (!stream) return
  // Publish anything new
  for (const t of stream.getTracks()) {
    const source = t.kind === 'video' ? videoSource : audioSource
    const already = lp.getTrackPublication(source)?.track?.mediaStreamTrack === t
    if (already) continue
    try {
      await lp.publishTrack(t, { source })
    } catch (err) {
      console.warn('[LiveKit] publishTrack failed', err)
    }
  }
}
