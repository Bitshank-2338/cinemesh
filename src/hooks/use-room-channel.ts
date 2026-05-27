'use client'

import {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react'
import { nanoid } from 'nanoid'
import { createChannel } from '@/lib/channel'
import type {
  RoomChannelAdapter,
  PresenceInfo,
  ChatPayload,
  SyncPayload,
  SyncAction,
  ModerationPayload,
  ModerationAction,
} from '@/lib/channel'

export interface RoomParticipant extends PresenceInfo {}

export interface UseRoomChannelOptions {
  roomId:       string
  participantId: string
  name:         string
  isHost:       boolean
}

export interface RoomChannelState {
  participants:  RoomParticipant[]
  messages:      ChatPayload[]
  syncState:     SyncPayload | null
  connected:     boolean
  error:         string | null
  transport:     'supabase' | 'local'

  /** Latest moderation event received (mostly used by callers via onModeration). */
  lastModeration: ModerationPayload | null

  sendMessage:    (content: string) => void
  sendSync:       (action: SyncAction, time: number) => void
  updatePresence: (patch: Partial<PresenceInfo>) => void
  /** Host-only: kick / mute / stop-share another participant */
  sendModeration: (targetId: string, action: ModerationAction) => void

  /** The raw adapter — pass to WebRTCManager */
  channel:       RoomChannelAdapter | null
}

export function useRoomChannel(
  opts: UseRoomChannelOptions | null
): RoomChannelState {
  const [participants,    setParticipants]    = useState<RoomParticipant[]>([])
  const [messages,        setMessages]        = useState<ChatPayload[]>([])
  const [syncState,       setSyncState]       = useState<SyncPayload | null>(null)
  const [connected,       setConnected]       = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [channel,         setChannel]         = useState<RoomChannelAdapter | null>(null)
  const [lastModeration,  setLastModeration]  = useState<ModerationPayload | null>(null)

  const channelRef = useRef<RoomChannelAdapter | null>(null)
  const optsRef    = useRef(opts)
  optsRef.current  = opts

  // Detect transport type
  const transport: 'supabase' | 'local' = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    return url && !url.includes('your-project') && url.startsWith('https://') && key
      ? 'supabase'
      : 'local'
  }, [])

  useEffect(() => {
    if (!opts) return

    const { roomId, participantId, name, isHost } = opts
    const ch = createChannel(roomId)
    channelRef.current = ch

    const presenceInfo: PresenceInfo = {
      participantId,
      name,
      isMuted:    false,
      isCameraOff: false,
      isHost,
      joinedAt:   Date.now(),
    }

    // ── Event listener ─────────────────────────────────────────────────────
    const unsub = ch.on((event) => {
      switch (event.kind) {
        case 'presence-sync': {
          // Convert to array, exclude self for remote participant list
          const all = Object.values(event.presence)
          setParticipants(all)
          break
        }
        case 'presence-join':
          setParticipants(prev => {
            const exists = prev.some(p => p.participantId === event.participant.participantId)
            return exists ? prev : [...prev, event.participant]
          })
          break
        case 'presence-leave':
          setParticipants(prev => prev.filter(p => p.participantId !== event.participantId))
          break
        case 'chat':
          setMessages(prev => {
            // Deduplicate by id
            if (prev.some(m => m.id === event.message.id)) return prev
            return [...prev.slice(-200), event.message]
          })
          break
        case 'sync':
          setSyncState(event.event)
          break
        case 'moderation':
          setLastModeration(event.payload)
          break
      }
    })

    // ── Join ───────────────────────────────────────────────────────────────
    ch.join(presenceInfo)
      .then(() => {
        setChannel(ch)
        setConnected(true)
        setError(null)

        // Add local participant immediately (don't wait for echo)
        setParticipants(prev => {
          const exists = prev.some(p => p.participantId === participantId)
          return exists ? prev : [...prev, presenceInfo]
        })
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to join room')
        setConnected(false)
      })

    return () => {
      unsub()
      ch.leave()
      channelRef.current = null
      setChannel(null)
      setConnected(false)
      setParticipants([])
      setMessages([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.roomId, opts?.participantId])

  // ── Actions ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback((content: string) => {
    const ch = channelRef.current
    const o  = optsRef.current
    if (!ch || !o) return
    ch.sendChat({
      id:              nanoid(),
      participantId:   o.participantId,
      participantName: o.name,
      content,
      timestamp:       Date.now(),
      type:            'message',
    })
  }, [])

  const sendSync = useCallback((action: SyncAction, time: number) => {
    const ch = channelRef.current
    const o  = optsRef.current
    if (!ch || !o) return
    ch.sendSync({
      action,
      time,
      issuerId:  o.participantId,
      issuedAt:  Date.now(),
    })
  }, [])

  const updatePresence = useCallback((patch: Partial<PresenceInfo>) => {
    channelRef.current?.updatePresence(patch)
    // Update locally too so the UI reflects immediately
    if (opts?.participantId) {
      setParticipants(prev =>
        prev.map(p =>
          p.participantId === opts.participantId ? { ...p, ...patch } : p
        )
      )
    }
  }, [opts?.participantId])

  const sendModeration = useCallback((targetId: string, action: ModerationAction) => {
    const ch = channelRef.current
    const o  = optsRef.current
    if (!ch || !o) return
    ch.sendModeration({
      targetId,
      action,
      issuerId: o.participantId,
      issuedAt: Date.now(),
    })
  }, [])

  return {
    participants,
    messages,
    syncState,
    connected,
    error,
    transport,
    lastModeration,
    sendMessage,
    sendSync,
    updatePresence,
    sendModeration,
    channel,
  }
}
