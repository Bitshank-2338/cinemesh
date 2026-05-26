'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, Smile, Hash } from 'lucide-react'
import type { ChatPayload as ChatMessage } from '@/lib/channel'
import { cn } from '@/lib/utils'
import { fadeUp } from '@/lib/motion'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (content: string) => void
  onClose?: () => void
  localParticipantId: string
}

const REACTIONS = ['🎬', '😂', '😱', '❤️', '🍿', '👏', '🔥', '😭']

const PARTICIPANT_COLORS: Record<string, string> = {
  default: '#c9a84c',
  1: '#60a5fa',
  2: '#a78bfa',
  3: '#34d399',
  4: '#f472b6',
}

function getMessageColor(participantId: string, isLocal: boolean): string {
  if (isLocal) return '#c9a84c'
  const idx = (participantId.charCodeAt(0) % 4) + 1
  return PARTICIPANT_COLORS[idx] ?? PARTICIPANT_COLORS.default
}

function MessageBubble({
  message,
  isLocal,
}: {
  message: ChatMessage
  isLocal: boolean
}) {
  const color = getMessageColor(message.participantId, isLocal)

  if (message.type === 'system') {
    return (
      <motion.div
        variants={fadeUp}
        className="flex justify-center py-1"
      >
        <span className="text-[11px] text-[#3a3a50] px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
          {message.content}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        'flex gap-2 group',
        isLocal ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar dot */}
      <div
        className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
        style={{ background: color }}
      />

      <div className={cn('flex flex-col max-w-[85%]', isLocal && 'items-end')}>
        {/* Name + time */}
        <div className={cn('flex items-baseline gap-2 mb-1', isLocal && 'flex-row-reverse')}>
          <span className="text-[11px] font-bold" style={{ color }}>
            {isLocal ? 'You' : message.participantName}
          </span>
          <span className="text-[10px] text-[#3a3a50]">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={cn(
            'px-3 py-2 rounded-2xl text-sm leading-relaxed',
            isLocal
              ? 'rounded-tr-sm'
              : 'rounded-tl-sm'
          )}
          style={{
            background: isLocal
              ? `rgba(201,168,76,0.1)`
              : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isLocal ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.07)'}`,
            color: '#e0e0ec',
          }}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  )
}

export function ChatPanel({
  messages,
  onSend,
  onClose,
  localParticipantId,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onSend(trimmed)
    setInput('')
    setShowEmoji(false)
  }

  const handleReaction = (emoji: string) => {
    onSend(emoji)
    setShowEmoji(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-[#5a5a72]" />
          <span className="text-sm font-semibold text-[#9090a8]">Chat</span>
          {messages.filter(m => m.type === 'message').length > 0 && (
            <span className="text-xs text-[#3a3a50]">
              · {messages.filter(m => m.type === 'message').length}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5a5a72] hover:text-[#9090a8] hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-3 text-center py-12"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                <Hash className="w-5 h-5 text-[#3a3a50]" />
              </div>
              <div>
                <p className="text-sm text-[#5a5a72] font-medium">No messages yet</p>
                <p className="text-xs text-[#3a3a50] mt-1">Be the first to say something!</p>
              </div>
            </motion.div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLocal={msg.participantId === localParticipantId}
              />
            ))
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="px-4 py-2 border-t border-white/[0.06]"
          >
            <div className="flex gap-2 flex-wrap">
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleReaction(r)}
                  className="text-xl hover:scale-125 transition-transform duration-150"
                >
                  {r}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <button
            onClick={() => setShowEmoji(v => !v)}
            className="shrink-0 text-[#5a5a72] hover:text-[#9090a8] transition-colors"
          >
            <Smile className="w-4 h-4" />
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Say something…"
            className="flex-1 bg-transparent text-sm text-[#f0f0f4] placeholder:text-[#3a3a50] outline-none"
          />

          <motion.button
            onClick={handleSend}
            disabled={!input.trim()}
            whileTap={{ scale: 0.9 }}
            className="shrink-0 p-1.5 rounded-lg transition-all duration-200 disabled:opacity-30"
            style={{
              background: input.trim() ? 'rgba(201,168,76,0.2)' : 'transparent',
              color: input.trim() ? '#c9a84c' : '#5a5a72',
            }}
          >
            <Send className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
