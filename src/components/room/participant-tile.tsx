'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Crown, WifiOff, VolumeX, VideoOff, Monitor, UserX } from 'lucide-react'
import type { RoomParticipant } from '@/hooks/use-room-channel'
import type { PeerConnectionState } from '@/hooks/use-webrtc'
import type { ModerationAction } from '@/lib/channel'
import { getInitials, cn } from '@/lib/utils'

interface ParticipantTileProps {
  participant:     RoomParticipant
  stream?:         MediaStream | null
  connectionState?: PeerConnectionState
  speaking?:       boolean
  isLocal?:        boolean
  size?:           'sm' | 'md' | 'lg'

  /** If set, render a host-only moderation menu (3-dot button) on remote tiles. */
  onModerate?:     (action: ModerationAction) => void
  /** Is this participant currently screen-sharing? Used to enable Stop Share. */
  isSharing?:      boolean
}

const AVATAR_GRADIENTS = [
  'from-[#c9a84c] to-[#b89040]',
  'from-[#3b82f6] to-[#1d4ed8]',
  'from-[#a78bfa] to-[#7c3aed]',
  'from-[#34d399] to-[#059669]',
  'from-[#f472b6] to-[#db2777]',
  'from-[#fb923c] to-[#ea580c]',
]

function getGradient(name: string): string {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length]
}

// ─── Compact moderation icon button used in the host control bar ──────────
function ModButton({
  icon: Icon,
  title,
  tone = 'neutral',
  disabled = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  tone?: 'red' | 'amber' | 'neutral'
  disabled?: boolean
  onClick: () => void
}) {
  const color = disabled
    ? '#5a5a72'
    : tone === 'red' ? '#f87171'
    : tone === 'amber' ? '#fbbf24'
    : '#f0f0f4'
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick() }}
      className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-white/10 active:scale-90"
      style={{ color, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      title={title}
      disabled={disabled}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

/**
 * Attach a MediaStream to a <video> element AND re-attach whenever the
 * stream's tracks change. Without addtrack/removetrack listeners, a
 * stream that gets a video track AFTER the initial bind (renegotiation,
 * camera coming on, etc.) leaves the element blank.
 */
function VideoEl({
  stream,
  muted = false,
  className,
}: {
  stream: MediaStream
  muted?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    el.play().catch(() => {})

    const replay = () => { el.play().catch(() => {}) }
    stream.addEventListener('addtrack',    replay)
    stream.addEventListener('removetrack', replay)

    return () => {
      stream.removeEventListener('addtrack',    replay)
      stream.removeEventListener('removetrack', replay)
      el.srcObject = null
    }
  }, [stream])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn('w-full h-full object-cover', className)}
    />
  )
}

export function ParticipantTile({
  participant,
  stream,
  connectionState,
  speaking = false,
  isLocal = false,
  size = 'md',
  onModerate,
  isSharing = false,
}: ParticipantTileProps) {
  const [confirmKick, setConfirmKick] = useState(false)
  const initials = getInitials(participant.name)
  const gradient = getGradient(participant.name)

  // Reactive video-track presence — recomputed on add/remove/ended events
  const [hasVideo, setHasVideo] = useState(false)
  useEffect(() => {
    if (!stream) { setHasVideo(false); return }
    const refresh = () => {
      setHasVideo(stream.getVideoTracks().some(t => t.readyState === 'live'))
    }
    refresh()
    stream.addEventListener('addtrack',    refresh)
    stream.addEventListener('removetrack', refresh)
    const offs: Array<() => void> = []
    for (const t of stream.getTracks()) {
      const h = () => refresh()
      t.addEventListener('ended', h)
      offs.push(() => t.removeEventListener('ended', h))
    }
    return () => {
      stream.removeEventListener('addtrack',    refresh)
      stream.removeEventListener('removetrack', refresh)
      offs.forEach(off => off())
    }
  }, [stream])

  const showVideo      = hasVideo && !participant.isCameraOff
  const isDisconnected = connectionState === 'failed' || connectionState === 'disconnected'

  return (
    <motion.div
      className={cn(
        'relative w-full aspect-video rounded-2xl overflow-hidden select-none',
        speaking && 'ring-2 ring-[#c9a84c] ring-offset-2 ring-offset-[#06060e]'
      )}
      style={{
        background: 'rgba(8,8,20,0.9)',
        border: `1px solid ${speaking
          ? 'rgba(201,168,76,0.4)'
          : 'rgba(255,255,255,0.07)'}`,
        boxShadow: speaking
          ? '0 0 30px rgba(201,168,76,0.15)'
          : '0 4px 24px rgba(0,0,0,0.5)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      layout
    >
      {/* Video or avatar */}
      {showVideo && stream ? (
        <VideoEl
          stream={stream}
          muted={isLocal}   // Always mute local to avoid echo
          className="absolute inset-0"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0d0d22] to-[#060610]">
          <div
            className={cn(
              'rounded-full flex items-center justify-center font-display font-bold text-white bg-gradient-to-br',
              gradient,
              size === 'sm' ? 'w-10 h-10 text-sm' : 'w-16 h-16 text-xl'
            )}
            style={{ boxShadow: speaking ? '0 0 30px rgba(201,168,76,0.3)' : 'none' }}
          >
            {initials}
          </div>
        </div>
      )}

      {/* Speaking ring pulse */}
      {speaking && (
        <motion.div
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ border: '2px solid rgba(201,168,76,0.6)' }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      {/* Disconnected overlay */}
      {isDisconnected && !isLocal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2">
          <WifiOff className="w-5 h-5 text-red-400" />
          <span className="text-xs text-red-400 font-medium">Reconnecting</span>
        </div>
      )}

      {/* Host moderation — inline icon row (always visible on remote tiles
          when the local user is host). Replaces the previous 3-dot menu so
          actions are one click away. Confirmation is required for kick. */}
      {onModerate && !isLocal && (
        <>
          <div
            className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 px-1 py-0.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
          >
            {/* Mute mic */}
            <ModButton
              icon={VolumeX}
              title={participant.isMuted ? 'Already muted' : 'Mute their mic'}
              tone="red"
              disabled={participant.isMuted}
              onClick={() => onModerate('mute-mic')}
            />
            {/* Turn off camera */}
            <ModButton
              icon={VideoOff}
              title={participant.isCameraOff ? 'Camera already off' : 'Turn off their camera'}
              tone="red"
              disabled={participant.isCameraOff}
              onClick={() => onModerate('stop-camera')}
            />
            {/* Stop screen share — only when they're sharing */}
            {isSharing && (
              <ModButton
                icon={Monitor}
                title="Stop their screen share"
                tone="amber"
                onClick={() => onModerate('stop-screen')}
              />
            )}
            {/* Kick (opens inline confirm) */}
            <ModButton
              icon={UserX}
              title="Remove from room"
              tone="red"
              onClick={() => setConfirmKick(true)}
            />
          </div>

          {/* Confirm-kick overlay */}
          <AnimatePresence>
            {confirmKick && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 px-3 text-center"
                style={{ background: 'rgba(8,4,4,0.92)', backdropFilter: 'blur(10px)' }}
              >
                <p className="text-sm text-[#f0f0f4] font-semibold">
                  Remove <span className="text-red-400">{participant.name}</span>?
                </p>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => { onModerate('kick'); setConfirmKick(false) }}
                    className="flex-1 py-1.5 rounded-md text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setConfirmKick(false)}
                    className="flex-1 py-1.5 rounded-md text-xs text-[#c0c0d0] bg-white/10 hover:bg-white/15 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Bottom label bar */}
      <div
        className="absolute bottom-0 left-0 right-0 px-2.5 py-2 flex items-center justify-between"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {participant.isHost && <Crown className="w-3 h-3 text-[#c9a84c] shrink-0" />}
          <span className="text-xs font-semibold text-[#f0f0f4] truncate">
            {isLocal ? `${participant.name} (you)` : participant.name}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {participant.isMuted ? (
            <div className="p-1 rounded-md bg-red-500/20">
              <MicOff className="w-2.5 h-2.5 text-red-400" />
            </div>
          ) : speaking ? (
            <div className="p-1 rounded-md bg-[rgba(201,168,76,0.2)]">
              <Mic className="w-2.5 h-2.5 text-[#c9a84c]" />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}
