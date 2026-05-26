'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film, Mic, MicOff, Video, VideoOff,
  Settings, Users, Copy, Check, ArrowRight, Wifi,
  AlertTriangle, RefreshCw, Crown,
} from 'lucide-react'
import { AmbientBackground } from '@/components/ui/ambient-background'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { useLocalMedia } from '@/hooks/use-local-media'
import { useRoomChannel } from '@/hooks/use-room-channel'
import { copyToClipboard, getInitials } from '@/lib/utils'
import { pageTransition, staggerBase, fadeUp } from '@/lib/motion'
import { nanoid } from 'nanoid'
import { upsertParticipant, removeParticipant, updateParticipantPresence, getRoomByCode } from '@/lib/room-service'
import { isSupabaseConfigured } from '@/lib/supabase'

// ─── Camera preview (attaches stream to <video>) ───────────────────────────
function CameraPreview({
  stream,
  name,
  isCameraOn,
}: {
  stream: MediaStream | null
  name: string
  isCameraOn: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el || !stream) return
    el.srcObject = stream
    el.play().catch(() => {})
    return () => { el.srcObject = null }
  }, [stream])

  if (!isCameraOn || !stream) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#0d1030] to-[#06060e]">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold font-display text-white"
          style={{
            background: 'linear-gradient(135deg, rgba(201,168,76,0.3), rgba(59,130,246,0.2))',
            border: '2px solid rgba(201,168,76,0.3)',
          }}
        >
          {getInitials(name)}
        </div>
        <p className="text-sm text-[#5a5a72]">Camera is off</p>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
    />
  )
}

// ─── Permission error banner ───────────────────────────────────────────────
function PermissionError({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  const messages: Record<string, string> = {
    'not-allowed':     'Camera/mic permission was denied. Click the camera icon in your browser bar to allow access.',
    'not-found':       'No camera or microphone found. Please connect a device and try again.',
    'in-use':          'Your camera is in use by another app. Close it and retry.',
    'not-supported':   'Your browser does not support camera access.',
    'overconstrained': 'Camera resolution not supported. Trying with lower settings…',
  }

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-2xl"
      style={{
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
      }}
    >
      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-400 mb-1">Media access error</p>
        <p className="text-xs text-[#9090a8]">{messages[error] ?? 'Could not access camera/microphone.'}</p>
      </div>
      <Button variant="ghost" size="sm" icon={RefreshCw} onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

// ─── Toggle control ────────────────────────────────────────────────────────
function ToggleControl({
  active, onToggle, iconOn: IconOn, iconOff: IconOff, label, dangerWhenOff = false,
}: {
  active: boolean
  onToggle: () => void
  iconOn: React.ComponentType<{ className?: string }>
  iconOff: React.ComponentType<{ className?: string }>
  label: string
  dangerWhenOff?: boolean
}) {
  const Icon = active ? IconOn : IconOff
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.04 }}
      className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200"
      style={{
        background: active ? 'rgba(255,255,255,0.07)' : dangerWhenOff ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.1)' : dangerWhenOff ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`,
        color: active ? '#f0f0f4' : dangerWhenOff ? '#f87171' : '#9090a8',
      }}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function LobbyPage() {
  const router = useRouter()
  const { roomId } = useParams()
  const searchParams = useSearchParams()

  const roomName        = searchParams.get('name') ?? 'Movie Night'
  const isHost          = searchParams.get('host') === 'true'
  const displayName     = searchParams.get('display') ?? 'You'
  // dbId may be passed via URL (preferred). If it's missing AND Supabase is
  // configured, we look it up by code below and either set it or bounce.
  const [dbId, setDbId] = useState(searchParams.get('dbId') ?? '')
  const [roomCheckError, setRoomCheckError] = useState<string | null>(null)

  // Stable participant ID for this session
  const participantId = useMemo(
    () => searchParams.get('pid') ?? nanoid(10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [copied,  setCopied]  = useState(false)
  const [joining, setJoining] = useState(false)

  // ── Room existence guard ─────────────────────────────────────────────────
  // If we don't already have a dbId and Supabase is configured, look up the
  // room by code. If it doesn't exist, send the user back to /join with an error.
  useEffect(() => {
    if (dbId) return                       // already have it from URL
    if (!isSupabaseConfigured()) return    // local mode — skip check
    let cancelled = false
    ;(async () => {
      const result = await getRoomByCode(roomId as string)
      if (cancelled) return
      if (!result.ok) {
        setRoomCheckError('Could not reach the room server.')
        return
      }
      if (!result.data) {
        // No such active room — bounce back to /join with the code as a hint
        router.replace(`/join?code=${encodeURIComponent(roomId as string)}&err=notfound`)
        return
      }
      setDbId(result.data.id)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Real media
  const media = useLocalMedia()

  // Real room channel for lobby presence
  const room = useRoomChannel({
    roomId:        roomId as string,
    participantId,
    name:          displayName,
    isHost,
  })

  // Request camera + mic on mount
  useEffect(() => {
    media.requestMedia()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync presence with media state
  useEffect(() => {
    room.updatePresence({
      isMuted:     !media.isMicOn,
      isCameraOff: !media.isCameraOn,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.isMicOn, media.isCameraOn])

  // Register participant row in DB on mount; remove on unmount
  // Uses dbId (UUID) — not roomId (code) — to satisfy the FK constraint
  useEffect(() => {
    if (!dbId) return   // skip if no UUID yet (local-mode fallback)
    upsertParticipant(dbId, {
      participantId,
      displayName,
      isHost,
    }).catch(() => {/* non-fatal */})

    return () => {
      removeParticipant(dbId, participantId).catch(() => {})
    }
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

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join?code=${roomId}`
    : `https://cinemesh.app/join?code=${roomId}`

  const handleCopy = async () => {
    await copyToClipboard(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEnterRoom = async () => {
    setJoining(true)
    media.stopAll() // Room page will re-request media fresh
    router.push(
      `/room/${roomId}` +
      `?name=${encodeURIComponent(roomName)}` +
      `&display=${encodeURIComponent(displayName)}` +
      `&host=${isHost}` +
      `&pid=${participantId}` +
      (dbId ? `&dbId=${dbId}` : ''),
    )
  }

  // Participants in lobby excluding self
  const otherParticipants = room.participants.filter(
    p => p.participantId !== participantId
  )

  return (
    <div className="relative min-h-screen flex flex-col">
      <AmbientBackground variant="lobby" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#c9a84c] flex items-center justify-center">
            <Film className="w-4 h-4 text-[#0a0808]" />
          </div>
          <span className="font-display font-bold text-lg text-gradient-gold">CineMesh</span>
        </Link>

        <div className="flex items-center gap-3">
          <Badge variant="green" dot size="md">Lobby open</Badge>
          <Badge variant="ghost" size="md">{roomId as string}</Badge>
          {room.transport === 'local' && (
            <Badge variant="gold" size="sm" title="BroadcastChannel — works in same browser only">
              Local mode
            </Badge>
          )}
        </div>
      </header>

      <motion.main
        className="relative z-10 flex-1 flex items-center justify-center px-6 py-8"
        variants={pageTransition}
        initial="initial"
        animate="animate"
      >
        <div className="w-full max-w-5xl">
          <motion.div
            className="grid lg:grid-cols-[1fr_360px] gap-6"
            variants={staggerBase}
            initial="hidden"
            animate="visible"
          >
            {/* ── Camera preview ──────────────────────────────────── */}
            <motion.div variants={fadeUp} className="space-y-4">
              <div
                className="relative aspect-video rounded-3xl overflow-hidden"
                style={{
                  background: 'rgba(8,8,20,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                }}
              >
                <CameraPreview
                  stream={media.localStream}
                  name={displayName}
                  isCameraOn={media.isCameraOn}
                />

                {/* Name tag */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm border border-white/[0.08]">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-[#f0f0f4]">{displayName} (you)</span>
                </div>

                {/* Muted badge */}
                {!media.isMicOn && (
                  <div className="absolute top-4 right-4 p-2 rounded-xl bg-red-500/20 border border-red-500/30">
                    <MicOff className="w-4 h-4 text-red-400" />
                  </div>
                )}

                {/* Requesting overlay */}
                {media.status === 'requesting' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin mx-auto" />
                      <p className="text-sm text-[#9090a8]">Requesting camera access…</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Permission error */}
              {media.status === 'error' && media.error && (
                <PermissionError error={media.error} onRetry={media.requestMedia} />
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <ToggleControl
                  active={media.isMicOn}
                  onToggle={media.toggleMic}
                  iconOn={Mic} iconOff={MicOff}
                  label={media.isMicOn ? 'Mic on' : 'Mic off'}
                  dangerWhenOff
                />
                <ToggleControl
                  active={media.isCameraOn}
                  onToggle={media.toggleCamera}
                  iconOn={Video} iconOff={VideoOff}
                  label={media.isCameraOn ? 'Camera on' : 'Camera off'}
                  dangerWhenOff
                />

                {/* Network status */}
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
                  style={{
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.15)',
                  }}
                >
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-medium text-xs hidden sm:inline">
                    {room.connected ? 'Connected' : 'Connecting…'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* ── Right panel ─────────────────────────────────────── */}
            <motion.div variants={fadeUp} className="space-y-4">
              <GlassCard padding="lg" rounded="2xl">
                <h2 className="font-display font-bold text-lg text-[#f0f0f4] mb-1">
                  {roomName}
                </h2>
                <p className="text-sm text-[#5a5a72] mb-4">
                  {isHost ? 'You\'re the host' : `Joining as ${displayName}`}
                </p>

                {/* Invite link */}
                <div className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] mb-4">
                  <span className="flex-1 text-xs text-[#5a5a72] font-mono truncate">{inviteUrl}</span>
                  <motion.button
                    onClick={handleCopy}
                    whileTap={{ scale: 0.92 }}
                    className="shrink-0 p-1.5 rounded-lg transition-colors"
                    style={{
                      background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                      color:      copied ? '#4ade80'              : '#9090a8',
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {copied
                        ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-4 h-4" /></motion.div>
                        : <motion.div key="cp" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy className="w-4 h-4" /></motion.div>
                      }
                    </AnimatePresence>
                  </motion.button>
                </div>

                <Button
                  variant="primary" size="lg" fullWidth
                  icon={ArrowRight} iconPosition="right"
                  loading={joining}
                  onClick={handleEnterRoom}
                  glow
                >
                  {joining ? 'Entering room…' : isHost ? 'Start the room' : 'Enter room'}
                </Button>
              </GlassCard>

              {/* Waiting list — real presence */}
              <GlassCard padding="lg" rounded="2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#5a5a72]" />
                    <span className="text-sm font-semibold text-[#9090a8]">In lobby</span>
                  </div>
                  <Badge variant="ghost" size="sm">{room.participants.length}</Badge>
                </div>

                <div className="space-y-2">
                  {/* Self */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.12)]">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#b89040] flex items-center justify-center text-xs font-bold text-[#0a0808]">
                      {getInitials(displayName)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#f0f0f4]">{displayName}</p>
                      <p className="text-xs text-[#5a5a72]">{isHost ? 'Host · you' : 'You'}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {media.isMicOn
                        ? <Mic className="w-3.5 h-3.5 text-green-400" />
                        : <MicOff className="w-3.5 h-3.5 text-red-400" />}
                      {media.isCameraOn
                        ? <Video className="w-3.5 h-3.5 text-green-400" />
                        : <VideoOff className="w-3.5 h-3.5 text-[#5a5a72]" />}
                    </div>
                  </div>

                  {/* Remote participants in lobby */}
                  <AnimatePresence>
                    {otherParticipants.map(p => (
                      <motion.div
                        key={p.participantId}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] flex items-center justify-center text-xs font-bold text-white">
                          {getInitials(p.name)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            {p.isHost && <Crown className="w-3 h-3 text-[#c9a84c]" />}
                            <p className="text-sm font-semibold text-[#f0f0f4]">{p.name}</p>
                          </div>
                          <p className="text-xs text-[#5a5a72]">In lobby</p>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {otherParticipants.length === 0 && (
                    <p className="text-xs text-[#3a3a50] text-center py-3">
                      Share the link to invite friends
                    </p>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        </div>
      </motion.main>
    </div>
  )
}
