'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { nanoid } from 'nanoid'
import { Film, Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react'

import { useRoomStore } from '@/store/room-store'
import { useLocalMedia } from '@/hooks/use-local-media'
import { upsertParticipant, removeParticipant, updateParticipantPresence } from '@/lib/room-service'
import { useRoomChannel } from '@/hooks/use-room-channel'
import { useWebRTC } from '@/hooks/use-webrtc'

import { ControlsDock } from '@/components/room/controls-dock'
import { ChatPanel } from '@/components/room/chat-panel'
import { ParticipantTile } from '@/components/room/participant-tile'
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

// ─── Main video area ──────────────────────────────────────────────────────────
function MainViewArea({
  screenStream,
  isPlaying,
  onTogglePlay,
}: {
  screenStream: MediaStream | null
  isPlaying: boolean
  onTogglePlay: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showControls, setShowControls] = useState(false)

  useEffect(() => {
    const el = videoRef.current
    if (!el || !screenStream) return
    el.srcObject = screenStream
    el.play().catch(() => {})
    return () => { el.srcObject = null }
  }, [screenStream])

  return (
    <div
      className="relative w-full h-full rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background: 'rgba(4,4,12,1)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={onTogglePlay}
    >
      {screenStream ? (
        /* Screen share feed */
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-contain"
        />
      ) : (
        /* Placeholder */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: 'linear-gradient(135deg, #0a1228 0%, #080618 40%, #0c0810 100%)' }}
        >
          {/* Film grain */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
          />
          <div className="relative z-10 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Film className="w-8 h-8 text-[#3a3a50]" />
            </div>
            <p className="text-[#5a5a72] font-medium text-sm">No screen shared</p>
            <p className="text-[#3a3a50] text-xs max-w-[200px] mx-auto leading-relaxed">
              Click "Share" in the dock to share your screen with everyone
            </p>
          </div>
        </div>
      )}

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

  // ── Media ───────────────────────────────────────────────────────────────
  const media = useLocalMedia()

  // ── Channel (presence + chat + sync + signaling) ────────────────────────
  const room = useRoomChannel({
    roomId:        roomId as string,
    participantId,
    name:          displayName,
    isHost,
  })

  // ── WebRTC (P2P video/audio + screen share) ─────────────────────────────
  const webrtc = useWebRTC(participantId, joinedAt, room.channel, media.localStream, media.screenStream)

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

  const activeScreenStream = media.isScreenSharing
    ? media.screenStream
    : null

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

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Main + participant strip */}
          <div className="flex flex-1 gap-3 p-3 overflow-hidden">
            {/* Main view (screen share or placeholder) */}
            <div className="flex-1 min-w-0">
              <MainViewArea
                screenStream={activeScreenStream}
                isPlaying={playback.isPlaying}
                onTogglePlay={handleTogglePlay}
              />
            </div>

            {/* Participant strip */}
            <div className="w-[130px] flex flex-col gap-2 overflow-y-auto shrink-0">
              {/* Local tile */}
              <ParticipantTile
                participant={localParticipant}
                stream={media.localStream}
                isLocal
                size="sm"
              />

              {/* Remote tiles */}
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
                      stream={webrtc.remoteStreams[p.participantId] ?? null}
                      connectionState={webrtc.connectionStates[p.participantId]}
                      size="sm"
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
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

          {/* Controls dock */}
          <div className="shrink-0 pb-4">
            <ControlsDock
              isMicOn={media.isMicOn}
              isCameraOn={media.isCameraOn}
              isScreenSharing={media.isScreenSharing}
              isChatOpen={isChatOpen}
              participantCount={room.participants.length}
              roomCode={roomId as string}
              onToggleMic={() => {
                media.toggleMic()
              }}
              onToggleCamera={() => {
                media.toggleCamera()
              }}
              onToggleScreenShare={handleScreenShare}
              onToggleChat={toggleChat}
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
    </div>
  )
}
