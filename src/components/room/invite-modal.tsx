'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check, Link2, Users, QrCode } from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'
import { modalOverlay, modalContent } from '@/lib/motion'

interface InviteModalProps {
  roomCode: string
  roomName: string
  participantCount: number
  onClose: () => void
}

export function InviteModal({
  roomCode,
  roomName,
  participantCount,
  onClose,
}: InviteModalProps) {
  const [copied, setCopied] = useState(false)

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join?code=${roomCode}`
    : `https://cinemesh.app/join?code=${roomCode}`

  const handleCopy = async () => {
    await copyToClipboard(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      variants={modalOverlay}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-md"
        variants={modalContent}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(10,10,22,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.2)] flex items-center justify-center">
                <Users className="w-4 h-4 text-[#c9a84c]" />
              </div>
              <div>
                <h2 className="font-display font-bold text-[#f0f0f4] text-base">Invite friends</h2>
                <p className="text-xs text-[#5a5a72]">{roomName} · {participantCount} here</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#5a5a72] hover:text-[#9090a8] hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Room code display */}
            <div className="text-center">
              <p className="text-xs text-[#5a5a72] uppercase tracking-widest font-semibold mb-3">
                Room code
              </p>
              <div
                className="inline-flex items-center gap-1 px-6 py-3 rounded-2xl"
                style={{
                  background: 'rgba(201,168,76,0.08)',
                  border: '1px solid rgba(201,168,76,0.2)',
                }}
              >
                {roomCode.split('').map((char, i) => (
                  <span
                    key={i}
                    className="text-3xl font-bold font-mono text-gradient-gold"
                    style={{ letterSpacing: '0.1em' }}
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>

            {/* URL copy */}
            <div>
              <p className="text-xs text-[#5a5a72] uppercase tracking-widest font-semibold mb-2">
                Invite link
              </p>
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Link2 className="w-4 h-4 text-[#5a5a72] shrink-0" />
                <span className="flex-1 text-sm text-[#7070a0] truncate font-mono">
                  {inviteUrl}
                </span>
                <motion.button
                  onClick={handleCopy}
                  whileTap={{ scale: 0.9 }}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                  style={{
                    background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(201,168,76,0.15)',
                    color: copied ? '#4ade80' : '#c9a84c',
                    border: `1px solid ${copied ? 'rgba(34,197,94,0.25)' : 'rgba(201,168,76,0.25)'}`,
                  }}
                >
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied
                      </motion.span>
                    ) : (
                      <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1">
                        <Copy className="w-3 h-3" /> Copy
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>

            <p className="text-center text-xs text-[#3a3a50]">
              Anyone with this link can join your room instantly.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
