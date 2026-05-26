'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, Users, Play, Pause, RefreshCw } from 'lucide-react'
import { formatDuration } from '@/lib/utils'

interface PlaybackSyncBarProps {
  isPlaying: boolean
  currentTime: number
  duration?: number
  participantCount: number
  isSynced: boolean
  onSync?: () => void
}

export function PlaybackSyncBar({
  isPlaying,
  currentTime,
  duration = 0,
  participantCount,
  isSynced,
  onSync,
}: PlaybackSyncBarProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
      style={{
        background: 'rgba(8,8,22,0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Sync status */}
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: isSynced ? '#22c55e' : '#f59e0b',
            boxShadow: isSynced
              ? '0 0 8px rgba(34,197,94,0.8)'
              : '0 0 8px rgba(245,158,11,0.8)',
          }}
        />
        <span className="text-xs font-semibold" style={{ color: isSynced ? '#4ade80' : '#fbbf24' }}>
          {isSynced ? 'Synced' : 'Syncing…'}
        </span>
      </div>

      <div className="w-px h-4 bg-white/[0.08]" />

      {/* Playback state */}
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Play className="w-3.5 h-3.5 text-[#c9a84c]" fill="currentColor" />
            </motion.div>
          ) : (
            <motion.div key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Pause className="w-3.5 h-3.5 text-[#9090a8]" fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="text-xs text-[#7070a0] font-mono">
          {formatDuration(currentTime)}
          {duration > 0 && (
            <span className="text-[#3a3a50]"> / {formatDuration(duration)}</span>
          )}
        </span>
      </div>

      {/* Progress bar (small) */}
      {duration > 0 && (
        <>
          <div className="w-px h-4 bg-white/[0.08]" />
          <div className="w-24 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #c9a84c, #3b82f6)',
                width: `${progress}%`,
              }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>
        </>
      )}

      <div className="w-px h-4 bg-white/[0.08]" />

      {/* Participants */}
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-[#5a5a72]" />
        <span className="text-xs text-[#7070a0]">
          {participantCount} watching
        </span>
      </div>

      {/* Re-sync button */}
      {!isSynced && onSync && (
        <motion.button
          onClick={onSync}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold text-[#fbbf24] transition-colors hover:bg-[rgba(245,158,11,0.12)]"
        >
          <RefreshCw className="w-3 h-3" />
          Sync
        </motion.button>
      )}
    </motion.div>
  )
}
