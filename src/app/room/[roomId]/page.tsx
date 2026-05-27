'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { nanoid } from 'nanoid'
import { Film, Wifi, WifiOff, AlertTriangle, RefreshCw, Maximize2, Minimize2, MessageSquare, X } from 'lucide-react'

import { useRoomStore } from '@/store/room-store'
import { useLocalMedia } from '@/hooks/use-local-media'
import { upsertParticipant, removeParticipant, updateParticipantPresence } from '@/lib/room-service'
import { useRoomChannel } from '@/hooks/use-room-channel'
import { useWebRTC, type PeerConnectionState } from '@/hooks/use-webrtc'
import { useLiveKitRoom, isLiveKitConfigured } from '@/hooks/use-livekit-room'
import type { ChatPayload } from '@/lib/channel'

import { ControlsDock } from '@/components/room/controls-dock'
import { ChatPanel } from '@/components/room/chat-panel'
import { ParticipantTile } from '@/components/room/participant-tile'
import { PipWindow, isDocumentPipSupported } from '@/components/room/pip-window'
import { PipBody } from '@/components/room/pip-body'
import { PlaybackSyncBar } from '@/components/room/playback-sync-bar'
import { InviteModal } from '@/components/room/invite-modal'
import { SettingsModal } from '@/components/room/settings-modal'
import { AmbientBackground, ScanLine } from '@/components/ui/ambient-background'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Sync state ───────────────────────────────────────────────────────────────
interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  lastSyncedAt: number
}

// ─── Main video area (screen share + fullscreen overlay) ─────────────────────
interface MainViewAreaProps {
  screenStream:        MediaStream | null
  /** True when LOCAL user is the one sharing (we must mute to avoid echo) */
  isLocalShare:        boolean
  sharerName:          string | null
  isPlaying:           boolean
  onTogglePlay:        () => void
  /** Whether the chat panel is open in the SIDE layout (passed for overlay) */
  isChatOpen:          boolean
  /** Overlay slot: rendered on top of the video when fullscreen */
  fullscreenOverlay?:  React.ReactNode
  onFullscreenChange?: (isFs: boolean) => void
}

function MainViewArea({
  screenStream,
  isLocalShare,
  sharerName,
  isPlaying: _isPlaying,
  onTogglePlay,
  fullscreenOverlay,
  onFullscreenChange,
}: MainViewAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Attach stream
  useEffect(() => {
    const el = videoRef.current
    if (!el || !screenStream) return
    el.srcObject = screenStream
    el.muted = isLocalShare  // mute only local to avoid echo; remote should be audible
    el.play().catch(() => {})
    return () => { el.srcObject = null }
  }, [screenStream, isLocalShare])

  // Detect fullscreen state on this container
  useEffect(() => {
    const handler = () => {
      const fs = document.fullscreenElement === containerRef.current
      setIsFullscreen(fs)
      onFullscreenChange?.(fs)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [onFullscreenChange])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement === el) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen().catch(() => {})
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-2xl overflow-hidden group"
      style={{
        background: 'rgba(4,4,12,1)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
      }}
    >
      {screenStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          // muted is set imperatively in the effect so we don't fight React
          className="absolute inset-0 w-full h-full object-contain bg-black"
          onClick={onTogglePlay}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: 'linear-gradient(135deg, #0a1228 0%, #080618 40%, #0c0810 100%)' }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
          />
          <div className="relative z-10 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Film className="w-8 h-8 text-[#3a3a50]" />
            </div>
            <p className="text-[#5a5a72] font-medium text-sm">No screen shared</p>
            <p className="text-[#3a3a50] text-xs max-w-[240px] mx-auto leading-relaxed">
              Click &ldquo;Share&rdquo; in the dock to share your screen — or wait for someone else to share.
            </p>
          </div>
        </div>
      )}

      {/* Sharer label */}
      {screenStream && sharerName && !isFullscreen && (
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-medium z-10"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: '#f0f0f4' }}>
          {sharerName} is sharing
        </div>
      )}

      {/* Fullscreen button — always visible when a screen is shared.
          Touch devices have no hover; opacity-only was invisible there. */}
      {screenStream && !isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 p-2.5 rounded-xl text-white z-10 flex items-center gap-2 transition-transform hover:scale-105"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}
          title="Enter fullscreen (cam strip + chat overlay)"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="text-xs font-semibold hidden sm:inline">Fullscreen</span>
        </button>
      )}

      {/* Fullscreen overlay: cam strip + chat */}
      {isFullscreen && fullscreenOverlay}

      <ScanLine />
    </div>
  )
}

// ─── Connection error banner ───────────────────────────────────────────────────
function ConnectionBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl mx-3"
      style={{
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.2)',
      }}
    >
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
      <span className="text-xs text-red-300 flex-1">{error}</span>
      <button
        onClick={onRetry}
        className="shrink-0 flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
      >
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </motion.div>
  )
}

// ─── Fullscreen overlay: cam strip + collapsible chat ─────────────────────────
interface FullscreenOverlayProps {
  localParticipant:   RoomParticipantLike
  remoteParticipants: RoomParticipantLike[]
  localCamStream:     MediaStream | null
  remoteCameras:      Record<string, MediaStream>
  connectionStates:   Record<string, PeerConnectionState>
  messages:           ChatPayload[]
  onSend:             (s: string) => void
  localParticipantId: string
}

function FullscreenOverlay({
  localParticipant,
  remoteParticipants,
  localCamStream,
  remoteCameras,
  connectionStates,
  messages,
  onSend,
  localParticipantId,
}: FullscreenOverlayProps) {
  const [chatOpen, setChatOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const lastSeenLen = useRef(messages.length)

  // Track unread while chat is closed
  useEffect(() => {
    if (chatOpen) {
      setUnread(0)
      lastSeenLen.current = messages.length
    } else {
      setUnread(messages.length - lastSeenLen.current)
    }
  }, [messages.length, chatOpen])

  const exitFs = () => document.exitFullscreen().catch(() => {})

  return (
    <>
      {/* Top-right: exit fullscreen */}
      <button
        onClick={exitFs}
        className="absolute top-3 right-3 p-2 rounded-lg z-30 text-white"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
        title="Exit fullscreen"
      >
        <Minimize2 className="w-4 h-4" />
      </button>

      {/* Top-left: chat toggle */}
      <button
        onClick={() => setChatOpen(v => !v)}
        className="absolute top-3 left-3 p-2 rounded-lg z-30 text-white flex items-center gap-2"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      >
        <MessageSquare className="w-4 h-4" />
        <span className="text-xs font-medium">{chatOpen ? 'Hide chat' : 'Chat'}</span>
        {!chatOpen && unread > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#c9a84c] text-[#0a0808]">
            {unread}
          </span>
        )}
      </button>

      {/* Cam strip — bottom right column of small tiles */}
      <div className="absolute bottom-3 right-3 w-[160px] flex flex-col gap-2 z-20 max-h-[80vh] overflow-y-auto">
        <ParticipantTile
          participant={localParticipant}
          stream={localCamStream}
          isLocal
          size="sm"
        />
        {remoteParticipants.map(p => (
          <ParticipantTile
            key={p.participantId}
            participant={p}
            stream={remoteCameras[p.participantId] ?? null}
            connectionState={connectionStates[p.participantId]}
            size="sm"
          />
        ))}
      </div>

      {/* Chat panel — slides in from the left when chatOpen */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ x: -340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -340, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className="absolute top-0 bottom-0 left-0 w-[320px] z-20 flex flex-col"
            style={{
              background:    'rgba(8,8,20,0.92)',
              backdropFilter: 'blur(20px)',
              borderRight:    '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Make room for the top-left chat toggle button */}
            <div className="h-14 shrink-0" />
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                messages={messages}
                onSend={onSend}
                onClose={() => setChatOpen(false)}
                localParticipantId={localParticipantId}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Minimal type used by overlay; matches RoomParticipant from use-room-channel
type RoomParticipantLike = {
  participantId: string
  name:          string
  isMuted:       boolean
  isCameraOff:   boolean
  isHost:        boolean
  joinedAt:      number
}

// ─── Room page ────────────────────────────────────────────────────────────────
export default function RoomPage() {
  const router     = useRouter()
  const { roomId } = useParams()
  const params     = useSearchParams()

  const roomName    = params.get('name')    ?? 'Movie Night'
  const isHost      = params.get('host')    === 'true'
  const displayName = params.get('display') ?? 'You'
  const dbId        = params.get('dbId')    ?? ''
  // Reuse the participantId set in lobby so presence is consistent
  const participantId = useMemo(
    () => params.get('pid') ?? nanoid(10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const joinedAt = useMemo(() => Date.now(), [])

  // ── UI store ────────────────────────────────────────────────────────────
  const {
    isChatOpen, isSettingsOpen, isInviteOpen,
    setRoom, toggleChat, toggleSettings, toggleInvite, clearRoom,
  } = useRoomStore()

  // ── Floating PiP window (chat + cams in a separate OS window) ───────────
  const [isPipOpen, setIsPipOpen] = useState(false)
  const [pipSupported, setPipSupported] = useState(false)
  const [showPipHint, setShowPipHint] = useState(false)
  const pipHintDismissedRef = useRef(false)
  useEffect(() => { setPipSupported(isDocumentPipSupported()) }, [])

  // ── Media ───────────────────────────────────────────────────────────────
  const media = useLocalMedia()

  // ── Channel (presence + chat + sync + signaling) ────────────────────────
  const room = useRoomChannel({
    roomId:        roomId as string,
    participantId,
    name:          displayName,
    isHost,
  })

  // ── Media transport: LiveKit SFU if configured, else WebRTC mesh ─────
  // Both hooks ALWAYS run (React hook rules), but only the active one
  // actually connects. LiveKit takes precedence when NEXT_PUBLIC_LIVEKIT_URL
  // is set (Vercel env var).
  const useLk = isLiveKitConfigured()
  const livekit = useLiveKitRoom({
    roomId:        useLk ? (roomId as string) : null,
    identity:      participantId,
    displayName,
    isHost,
    cameraStream:  media.localStream,
    screenStream:  media.screenStream,
  })
  const mesh = useWebRTC(
    participantId,
    joinedAt,
    useLk ? null : room.channel,   // mesh signals over Realtime only when LiveKit is off
    useLk ? null : media.localStream,
    useLk ? null : media.screenStream,
  )

  // Unified transport interface — same shape regardless of which one is active.
  const webrtc = useLk
    ? {
        remoteCameras:    livekit.remoteCameras,
        remoteScreens:    livekit.remoteScreens,
        connectionStates: livekit.connectionStates,
      }
    : mesh

  // ── Playback sync ────────────────────────────────────────────────────────
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying:    false,
    currentTime:  0,
    lastSyncedAt: Date.now(),
  })
  const playbackRef = useRef(playback)
  playbackRef.current = playback

  // Apply incoming sync events
  useEffect(() => {
    if (!room.syncState) return
    const { action, time } = room.syncState
    setPlayback(prev => ({
      ...prev,
      isPlaying:    action === 'play' ? true : action === 'pause' ? false : prev.isPlaying,
      currentTime:  time,
      lastSyncedAt: Date.now(),
    }))
  }, [room.syncState])

  // Tick playback forward when playing
  useEffect(() => {
    if (!playback.isPlaying) return
    const id = setInterval(() => {
      setPlayback(prev => ({
        ...prev,
        currentTime: prev.currentTime + 1,
      }))
    }, 1000)
    return () => clearInterval(id)
  }, [playback.isPlaying])

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setRoom(roomId as string, roomName, roomId as string)
    media.requestMedia()
    return () => clearRoom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync presence with media toggles
  useEffect(() => {
    room.updatePresence({
      isMuted:     !media.isMicOn,
      isCameraOff: !media.isCameraOn,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.isMicOn, media.isCameraOn])

  // Auto-show floating-window hint the first time the user starts sharing
  useEffect(() => {
    if (media.isScreenSharing && !isPipOpen && !pipHintDismissedRef.current) {
      setShowPipHint(true)
    }
    if (!media.isScreenSharing) {
      setShowPipHint(false)
    }
  }, [media.isScreenSharing, isPipOpen])

  // ── Receive host moderation commands ────────────────────────────────────
  // The host broadcasts a 'moderation' event; every client receives it and
  // applies the action ONLY if the target is themselves and the issuer is
  // actually the host (presence isHost=true). Without an SFU we can't
  // enforce mute server-side — this is a cooperative protocol.
  const [kicked, setKicked] = useState<{ by: string } | null>(null)
  useEffect(() => {
    const mod = room.lastModeration
    if (!mod) return
    if (mod.targetId !== participantId) return

    // Verify the issuer is the actual room host
    const issuer = room.participants.find(p => p.participantId === mod.issuerId)
    if (!issuer?.isHost) return

    switch (mod.action) {
      case 'mute-mic':
        if (media.isMicOn) media.toggleMic()
        break
      case 'stop-camera':
        if (media.isCameraOn) media.toggleCamera()
        break
      case 'stop-screen':
        if (media.isScreenSharing) media.stopScreen()
        break
      case 'kick':
        setKicked({ by: issuer.name })
        // Tear down media + leave room. The room page will redirect below.
        media.stopAll()
        break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.lastModeration])

  // After being kicked, give the user a moment to read the message, then bounce
  useEffect(() => {
    if (!kicked) return
    const t = setTimeout(() => {
      router.replace(`/join?err=kicked&by=${encodeURIComponent(kicked.by)}`)
    }, 2500)
    return () => clearTimeout(t)
  }, [kicked, router])

  // Helper: who's currently screen-sharing (for the "Stop share" menu item)
  const sharingIds = useMemo(() => {
    const ids = new Set<string>()
    for (const pid of Object.keys(webrtc.remoteScreens)) ids.add(pid)
    if (media.isScreenSharing) ids.add(participantId)
    return ids
  }, [webrtc.remoteScreens, media.isScreenSharing, participantId])

  // Register participant row in DB; remove on unmount
  useEffect(() => {
    if (!dbId) return
    upsertParticipant(dbId, { participantId, displayName, isHost }).catch(() => {})
    return () => { removeParticipant(dbId, participantId).catch(() => {}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbId])

  // Heartbeat every 10 s
  useEffect(() => {
    if (!dbId) return
    const timer = setInterval(() => {
      updateParticipantPresence(dbId, participantId, {
        isMuted:     !media.isMicOn,
        isCameraOff: !media.isCameraOn,
      }).catch(() => {})
    }, 10_000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbId, media.isMicOn, media.isCameraOn])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleTogglePlay = useCallback(() => {
    const next = !playbackRef.current.isPlaying
    setPlayback(prev => ({ ...prev, isPlaying: next }))
    room.sendSync(next ? 'play' : 'pause', playbackRef.current.currentTime)
  }, [room])

  const handleScreenShare = useCallback(async () => {
    if (media.isScreenSharing) {
      media.stopScreen()
    } else {
      await media.startScreen()
    }
  }, [media])

  const handleLeave = useCallback(() => {
    media.stopAll()
    clearRoom()
    router.push('/')
  }, [media, clearRoom, router])

  const handleRetryMedia = useCallback(() => {
    media.requestMedia()
  }, [media])

  // ── Derived data ──────────────────────────────────────────────────────────
  const remoteParticipants = room.participants.filter(
    p => p.participantId !== participantId
  )
  const localParticipant = room.participants.find(
    p => p.participantId === participantId
  ) ?? {
    participantId,
    name:        displayName,
    isMuted:     !media.isMicOn,
    isCameraOff: !media.isCameraOn,
    isHost,
    joinedAt,
  }

  // ── Pick the active screen to display in the main view ──────────────────
  // Priority: 1) someone remote is sharing → show theirs (with audio);
  //           2) we are sharing → show local preview (muted to avoid echo);
  //           3) nothing.
  const remoteScreenEntry = useMemo(() => {
    for (const p of remoteParticipants) {
      const s = webrtc.remoteScreens[p.participantId]
      if (s) return { stream: s, name: p.name, isLocal: false }
    }
    return null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webrtc.remoteScreens, remoteParticipants])

  const activeScreen: { stream: MediaStream; name: string; isLocal: boolean } | null =
    remoteScreenEntry ??
    (media.isScreenSharing && media.screenStream
      ? { stream: media.screenStream, name: 'You', isLocal: true }
      : null)

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-[#06060e]">
      <AmbientBackground variant="room" />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <motion.header
        className="relative z-20 flex items-center justify-between px-5 py-3 shrink-0"
        style={{
          background: 'rgba(6,6,14,0.7)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo + Room name */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#c9a84c] flex items-center justify-center">
            <Film className="w-3.5 h-3.5 text-[#0a0808]" />
          </div>
          <div className="hidden sm:block w-px h-5 bg-white/[0.08]" />
          <h1 className="font-display font-bold text-sm text-[#f0f0f4] hidden sm:block">
            {roomName}
          </h1>
          {isHost && <Badge variant="gold" size="sm" className="hidden sm:inline-flex">Host</Badge>}
          {room.transport === 'local' && (
            <Badge variant="ghost" size="sm" className="hidden sm:inline-flex" title="Same-browser BroadcastChannel — open in another tab to test">
              Local
            </Badge>
          )}
        </div>

        {/* Center sync bar */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
          <PlaybackSyncBar
            isPlaying={playback.isPlaying}
            currentTime={playback.currentTime}
            participantCount={room.participants.length}
            isSynced={room.connected}
            onSync={() => room.sendSync('seek', playback.currentTime)}
          />
        </div>

        {/* Right — status + avatars */}
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          {room.connected
            ? <Wifi className="w-4 h-4 text-green-400" />
            : <WifiOff className="w-4 h-4 text-red-400" />
          }
          {/* Quality / scale warning when the mesh is getting crowded.
              At >8 peers, per-peer video bitrate auto-drops. At >14 it
              gets quite compressed; suggest audio-only or fewer cams. */}
          {room.participants.length > 8 && (
            <Badge
              variant={room.participants.length > 14 ? 'gold' : 'ghost'}
              size="sm"
              title={
                room.participants.length > 14
                  ? `Large room (${room.participants.length}). Video quality is reduced to keep the connection stable. For best results above 15 people, turn cameras off and use voice + screen share only.`
                  : `Room is busy (${room.participants.length}). Video quality auto-reduced for stability.`
              }
            >
              {room.participants.length > 14 ? 'Audio-friendly' : 'Reduced quality'}
            </Badge>
          )}
          <Badge variant="ghost" size="sm">{roomId as string}</Badge>

          {/* Participant avatar stack */}
          <div className="flex -space-x-1.5">
            {room.participants.slice(0, 4).map(p => (
              <div
                key={p.participantId}
                className="w-7 h-7 rounded-full border-2 border-[#06060e] flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.5), rgba(59,130,246,0.4))' }}
                title={p.name}
              >
                {p.name[0]?.toUpperCase()}
              </div>
            ))}
            {room.participants.length > 4 && (
              <div
                className="w-7 h-7 rounded-full border-2 border-[#06060e] flex items-center justify-center text-[10px] text-[#9090a8]"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              >
                +{room.participants.length - 4}
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* ── Connection error ─────────────────────────────────────── */}
      {room.error && (
        <ConnectionBanner error={room.error} onRetry={handleRetryMedia} />
      )}

      {/* ── Kicked overlay (full-screen blocker) ─────────────────── */}
      <AnimatePresence>
        {kicked && (
          <motion.div
            key="kicked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.92, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="text-center max-w-md px-6"
            >
              <div className="w-16 h-16 rounded-2xl mx-auto mb-5 bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <span className="text-3xl">🚪</span>
              </div>
              <h2 className="text-2xl font-display font-bold text-[#f0f0f4] mb-2">
                You were removed
              </h2>
              <p className="text-sm text-[#9090a8]">
                <span className="font-semibold text-[#f0f0f4]">{kicked.by}</span> removed you from the room.
              </p>
              <p className="text-xs text-[#5a5a72] mt-3">Redirecting…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Main + participant strip */}
          <div className="flex flex-1 gap-3 p-3 overflow-hidden">
            {/* Main view (screen share or placeholder) */}
            <div className="flex-1 min-w-0">
              <MainViewArea
                screenStream={activeScreen?.stream ?? null}
                isLocalShare={activeScreen?.isLocal ?? false}
                sharerName={activeScreen?.name ?? null}
                isPlaying={playback.isPlaying}
                onTogglePlay={handleTogglePlay}
                isChatOpen={isChatOpen}
                fullscreenOverlay={
                  <FullscreenOverlay
                    localParticipant={localParticipant}
                    remoteParticipants={remoteParticipants}
                    localCamStream={media.localStream}
                    remoteCameras={webrtc.remoteCameras}
                    connectionStates={webrtc.connectionStates}
                    messages={room.messages}
                    onSend={room.sendMessage}
                    localParticipantId={participantId}
                  />
                }
              />
            </div>

            {/* Participant strip — vertical for small rooms, compact 2-col grid
                for larger rooms so we don't run out of vertical space at 20. */}
            {(() => {
              const total = 1 + remoteParticipants.length
              const useGrid = total > 6
              const containerClass = useGrid
                ? 'w-[260px] grid grid-cols-2 gap-1.5 content-start overflow-y-auto shrink-0'
                : 'w-[130px] flex flex-col gap-2 overflow-y-auto shrink-0'
              return (
                <div className={containerClass}>
                  <ParticipantTile
                    participant={localParticipant}
                    stream={media.localStream}
                    isLocal
                    size="sm"
                  />
                  <AnimatePresence>
                    {remoteParticipants.map(p => (
                      <motion.div
                        key={p.participantId}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <ParticipantTile
                          participant={p}
                          stream={webrtc.remoteCameras[p.participantId] ?? null}
                          connectionState={webrtc.connectionStates[p.participantId]}
                          size="sm"
                          isSharing={sharingIds.has(p.participantId)}
                          onModerate={isHost ? (action) => room.sendModeration(p.participantId, action) : undefined}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )
            })()}
          </div>

          {/* Mobile sync bar */}
          <div className="px-3 pb-2 md:hidden">
            <PlaybackSyncBar
              isPlaying={playback.isPlaying}
              currentTime={playback.currentTime}
              participantCount={room.participants.length}
              isSynced={room.connected}
            />
          </div>

          {/* Floating-window hint that appears once after screen sharing starts.
              Click → opens the Document PiP (or popup fallback). The PiP window
              floats above other browsers (Chrome/Edge), so you can watch the
              movie in another window while still seeing chat + cams. */}
          <AnimatePresence>
            {showPipHint && (
              <motion.div
                key="pip-hint"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 max-w-md w-[92%]"
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
                  style={{
                    background:    'linear-gradient(135deg, rgba(201,168,76,0.18), rgba(59,130,246,0.14))',
                    border:        '1px solid rgba(201,168,76,0.4)',
                    backdropFilter: 'blur(20px)',
                    boxShadow:     '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(201,168,76,0.18)',
                  }}
                >
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-[#c9a84c]/20 border border-[#c9a84c]/30 flex items-center justify-center">
                    <span className="text-lg">📌</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#f0f0f4]">Pop chat + cams into a floating window?</p>
                    <p className="text-xs text-[#9090a8] mt-0.5">
                      {pipSupported
                        ? 'Stays on top of every other app and is invisible in your screen share.'
                        : 'Opens as a popup window you can drag to a corner of your screen.'}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { setIsPipOpen(true); setShowPipHint(false); pipHintDismissedRef.current = true }}
                  >
                    Open
                  </Button>
                  <button
                    onClick={() => { setShowPipHint(false); pipHintDismissedRef.current = true }}
                    className="shrink-0 p-1.5 rounded-lg text-[#9090a8] hover:text-white hover:bg-white/10"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls dock */}
          <div className="shrink-0 pb-4">
            <ControlsDock
              isMicOn={media.isMicOn}
              isCameraOn={media.isCameraOn}
              isScreenSharing={media.isScreenSharing}
              isChatOpen={isChatOpen}
              isPipOpen={isPipOpen}
              isPipSupported={pipSupported}
              participantCount={room.participants.length}
              roomCode={roomId as string}
              onToggleMic={() => media.toggleMic()}
              onToggleCamera={() => media.toggleCamera()}
              onToggleScreenShare={handleScreenShare}
              onToggleChat={toggleChat}
              onTogglePip={() => setIsPipOpen(v => !v)}
              onLeave={handleLeave}
              onOpenSettings={toggleSettings}
              onOpenInvite={toggleInvite}
            />
          </div>
        </div>

        {/* Chat sidebar */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              key="chat"
              className="w-[300px] shrink-0 flex flex-col"
              style={{
                background: 'rgba(8,8,20,0.85)',
                backdropFilter: 'blur(20px)',
                borderLeft: '1px solid rgba(255,255,255,0.07)',
              }}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            >
              <ChatPanel
                messages={room.messages}
                onSend={room.sendMessage}
                onClose={toggleChat}
                localParticipantId={participantId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isInviteOpen && (
          <InviteModal
            roomCode={roomId as string}
            roomName={roomName}
            participantCount={room.participants.length}
            onClose={toggleInvite}
          />
        )}
        {isSettingsOpen && (
          <SettingsModal onClose={toggleSettings} />
        )}
      </AnimatePresence>

      {/* ── Floating Picture-in-Picture window ─────────────────────
          Renders to a separate OS-level always-on-top window
          (Chromium 116+). Since it's outside any browser, it does
          NOT show up in getDisplayMedia screen captures and floats
          above other apps so users can chat while watching the movie
          in a different browser/app. */}
      <PipWindow
        open={isPipOpen}
        onClose={() => setIsPipOpen(false)}
        width={400}
        height={680}
      >
        <PipBody
          localParticipant={localParticipant}
          remoteParticipants={remoteParticipants}
          localCamStream={media.localStream}
          remoteCameras={webrtc.remoteCameras}
          connectionStates={webrtc.connectionStates}
          messages={room.messages}
          onSend={room.sendMessage}
          localParticipantId={participantId}
          onPopBack={() => setIsPipOpen(false)}
          isMicOn={media.isMicOn}
          isCameraOn={media.isCameraOn}
          isScreenSharing={media.isScreenSharing}
          onToggleMic={media.toggleMic}
          onToggleCamera={media.toggleCamera}
          onToggleScreenShare={handleScreenShare}
        />
      </PipWindow>
    </div>
  )
}
