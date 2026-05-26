'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff,
  Video, VideoOff,
  Monitor, MonitorOff,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Check,
  Link2,
  PictureInPicture2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/lib/utils'

interface ControlsDockProps {
  isMicOn: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  isChatOpen: boolean
  isPipOpen: boolean
  isPipSupported: boolean
  participantCount: number
  roomCode: string
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onToggleChat: () => void
  onTogglePip: () => void
  onLeave: () => void
  onOpenSettings: () => void
  onOpenInvite: () => void
}

interface DockButtonProps {
  icon: React.ComponentType<{ className?: string }>
  offIcon?: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  danger?: boolean
  accent?: boolean
  badge?: number
  onClick: () => void
}

function DockButton({
  icon: Icon,
  offIcon: OffIcon,
  label,
  active = true,
  danger = false,
  accent = false,
  badge,
  onClick,
}: DockButtonProps) {
  const DisplayIcon = (!active && OffIcon) ? OffIcon : Icon

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="relative flex flex-col items-center gap-1.5 group"
      aria-label={label}
    >
      <div
        className="relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200"
        style={{
          background: danger
            ? 'rgba(239,68,68,0.15)'
            : accent
            ? 'rgba(201,168,76,0.15)'
            : active
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(255,255,255,0.05)',
          border: danger
            ? '1px solid rgba(239,68,68,0.25)'
            : accent
            ? '1px solid rgba(201,168,76,0.25)'
            : active
            ? '1px solid rgba(255,255,255,0.12)'
            : '1px solid rgba(255,255,255,0.06)',
          color: danger
            ? '#f87171'
            : accent
            ? '#c9a84c'
            : active
            ? '#f0f0f4'
            : '#5a5a72',
        }}
      >
        <DisplayIcon className="w-5 h-5" />

        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-[#0a0808]"
            style={{ background: '#c9a84c', padding: '0 4px' }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}

        {/* Active indicator */}
        {!active && !danger && (
          <span
            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
            style={{ background: '#5a5a72' }}
          />
        )}
      </div>

      <span
        className="text-[10px] font-medium transition-colors"
        style={{
          color: danger ? '#f87171' : active ? '#9090a8' : '#4a4a60',
        }}
      >
        {label}
      </span>
    </motion.button>
  )
}

function Divider() {
  return (
    <div
      className="hidden sm:block w-px h-10 self-center"
      style={{ background: 'rgba(255,255,255,0.07)' }}
    />
  )
}

export function ControlsDock({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isChatOpen,
  isPipOpen,
  isPipSupported,
  participantCount,
  roomCode,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleChat,
  onTogglePip,
  onLeave,
  onOpenSettings,
  onOpenInvite,
}: ControlsDockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/join?code=${roomCode}`
    await copyToClipboard(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      className="flex items-end justify-center px-4 py-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 28 }}
    >
      <div
        className="flex items-center gap-4 px-6 py-3 rounded-[2rem]"
        style={{
          background: 'rgba(8,8,22,0.92)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {/* Audio / Video */}
        <DockButton
          icon={Mic}
          offIcon={MicOff}
          label={isMicOn ? 'Mute' : 'Unmute'}
          active={isMicOn}
          onClick={onToggleMic}
        />
        <DockButton
          icon={Video}
          offIcon={VideoOff}
          label={isCameraOn ? 'Camera' : 'No cam'}
          active={isCameraOn}
          onClick={onToggleCamera}
        />

        <Divider />

        {/* Share */}
        <DockButton
          icon={Monitor}
          offIcon={MonitorOff}
          label={isScreenSharing ? 'Sharing' : 'Share'}
          active={isScreenSharing}
          accent={isScreenSharing}
          onClick={onToggleScreenShare}
        />

        <Divider />

        {/* Chat + Participants */}
        <DockButton
          icon={MessageSquare}
          label="Chat"
          active={isChatOpen}
          accent={isChatOpen}
          onClick={onToggleChat}
        />
        <DockButton
          icon={PictureInPicture2}
          label={isPipOpen ? 'Floating' : 'Float'}
          active={isPipOpen}
          accent={isPipOpen || !isPipSupported ? isPipOpen : false}
          onClick={onTogglePip}
        />
        <DockButton
          icon={Users}
          label={`${participantCount} here`}
          active={true}
          badge={participantCount}
          onClick={onOpenInvite}
        />

        <Divider />

        {/* Invite */}
        <motion.button
          onClick={handleCopyLink}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.93 }}
          className="relative flex flex-col items-center gap-1.5"
          aria-label="Copy invite link"
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200"
            style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)'}`,
              color: copied ? '#4ade80' : '#9090a8',
            }}
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div key="check" initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                  <Check className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.div key="link" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Link2 className="w-5 h-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span className="text-[10px] font-medium text-[#4a4a60]">{copied ? 'Copied!' : 'Invite'}</span>
        </motion.button>

        <DockButton
          icon={Settings}
          label="Settings"
          active={true}
          onClick={onOpenSettings}
        />

        <Divider />

        {/* Leave */}
        <DockButton
          icon={LogOut}
          label="Leave"
          active={true}
          danger
          onClick={onLeave}
        />
      </div>
    </motion.div>
  )
}
