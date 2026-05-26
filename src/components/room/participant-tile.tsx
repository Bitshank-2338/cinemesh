'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Crown, WifiOff } from 'lucide-react'
import type { RoomParticipant } from '@/hooks/use-room-channel'
import type { PeerConnectionState } from '@/hooks/use-webrtc'
import { getInitials, cn } from '@/lib/utils'

interface ParticipantTileProps {
  participant:     RoomParticipant
  stream?:         MediaStream | null
  connectionState?: PeerConnectionState
  speaking?:       boolean
  isLocal?:        boolean
  size?:           'sm' | 'md' | 'lg'
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
}: ParticipantTileProps) {
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
