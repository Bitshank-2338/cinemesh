'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, Smile, Hash, Sticker } from 'lucide-react'
import type { ChatPayload as ChatMessage } from '@/lib/channel'
import { cn } from '@/lib/utils'
import { fadeUp } from '@/lib/motion'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend:   (content: string) => void
  onClose?: () => void
  localParticipantId: string
}

// ─── Emoji catalogue ─────────────────────────────────────────────────────────
type EmojiCategory = { label: string; icon: string; emojis: string[] }

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    label: 'Movie',  icon: '🎬',
    emojis: ['🎬','🎥','🎞️','📽️','🎟️','🍿','🎭','🎪','🎤','🎧','🎵','🎶','🍔','🍕','🍟','🌮','🍣','🍩','🍪','🍰','🧁','🍫','🍦','🥤','🍷','🍺','🍸','🥂','🥃','🧃'],
  },
  {
    label: 'Faces',  icon: '😀',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬'],
  },
  {
    label: 'Hearts', icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','🌹','🌷','🌻','🌸','🌺','🌼','💐','✨','💫','⭐','🌟','💥','💢','💦','💨','💤','🕳️'],
  },
  {
    label: 'Hands',  icon: '👍',
    emojis: ['👍','👎','👏','🙌','👐','🤲','🤝','🙏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👋','🤚','🖐️','✋','🖖','💪','🦾','🤳','🫰','🫶','🫵','🫷','🫸','💃','🕺','🧘','🏃','🚶','🛌'],
  },
  {
    label: 'Symbols', icon: '🔥',
    emojis: ['🔥','💯','💢','💥','💫','⚡','💎','🏆','🥇','🎉','🎊','🎈','🎁','🎀','🎗️','🏅','🏵️','🎖️','✅','❌','⭕','❗','❓','‼️','⁉️','💤','💢','💯','🆗','🆒','🆕','🆙','🔝','🔥','💎','♻️'],
  },
  {
    label: 'Nature', icon: '🌈',
    emojis: ['🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','🌪️','🌫️','🌊','🌙','⭐','🌟','✨','☄️','💫','🌠','🪐','🌍','🌎','🌏'],
  },
]

// ─── Sticker catalogue ───────────────────────────────────────────────────────
// Stickers use the `STK:` prefix so they render larger than regular emojis.
const STICKERS = [
  '🍿🎬',  '🎬✨', '🎥🔥', '👀🍿', '😂🤣', '😱😱', '❤️🔥', '🥺👉👈',
  '🎉🥳', '💯💯', '🤝👏', '🚀🌙', '☕💤', '🌃✨', '👑😎', '🤯🤯',
  '😍😍', '🎀💖', '👻🎃', '🌸🌸', '🍕🍔', '🍷🥂', '🦋🌷', '🎶🎵',
]

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

// True if the entire message is one or a few emoji/symbols (or sticker prefix)
function isStickerMessage(content: string): boolean {
  if (content.startsWith('STK:')) return true
  // Treat short messages with no letters/numbers as stickers (oversized render)
  const stripped = content.replace(/\s/g, '')
  if (stripped.length === 0 || stripped.length > 12) return false
  return !/[a-zA-Z0-9]/.test(stripped)
}

function MessageBubble({
  message,
  isLocal,
}: {
  message: ChatMessage
  isLocal: boolean
}) {
  const color  = getMessageColor(message.participantId, isLocal)
  const sticker = isStickerMessage(message.content)
  const content = message.content.startsWith('STK:')
    ? message.content.slice(4)
    : message.content

  if (message.type === 'system') {
    return (
      <motion.div variants={fadeUp} className="flex justify-center py-1">
        <span className="text-[11px] text-[#3a3a50] px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
          {message.content}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={fadeUp}
      className={cn('flex gap-2 group', isLocal ? 'flex-row-reverse' : 'flex-row')}
    >
      <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: color }} />

      <div className={cn('flex flex-col max-w-[85%]', isLocal && 'items-end')}>
        <div className={cn('flex items-baseline gap-2 mb-1', isLocal && 'flex-row-reverse')}>
          <span className="text-[11px] font-bold" style={{ color }}>
            {isLocal ? 'You' : message.participantName}
          </span>
          <span className="text-[10px] text-[#3a3a50]">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour:   '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {sticker ? (
          <span className="text-4xl leading-none select-none" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>
            {content}
          </span>
        ) : (
          <div
            className={cn(
              'px-3 py-2 rounded-2xl text-sm leading-relaxed',
              isLocal ? 'rounded-tr-sm' : 'rounded-tl-sm',
            )}
            style={{
              background: isLocal ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.05)',
              border:     `1px solid ${isLocal ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.07)'}`,
              color:      '#e0e0ec',
            }}
          >
            {content}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Picker ──────────────────────────────────────────────────────────────────
function Picker({
  mode,
  onPick,
}: {
  mode: 'emoji' | 'sticker'
  onPick: (s: string) => void
}) {
  const [cat, setCat] = useState(0)

  if (mode === 'sticker') {
    return (
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <p className="text-[10px] uppercase tracking-widest text-[#5a5a72] mb-2 font-bold">Stickers</p>
        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
          {STICKERS.map(s => (
            <button
              key={s}
              onClick={() => onPick('STK:' + s)}
              className="aspect-square rounded-xl flex items-center justify-center text-2xl hover:scale-110 transition-transform"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border:     '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const active = EMOJI_CATEGORIES[cat]
  return (
    <div className="px-3 py-2 border-t border-white/[0.06]">
      {/* Category tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.label}
            onClick={() => setCat(i)}
            className={cn(
              'shrink-0 px-2 py-1 rounded-lg text-base transition-colors',
              i === cat ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]',
            )}
            title={c.label}
          >
            {c.icon}
          </button>
        ))}
      </div>
      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto pr-1">
        {active.emojis.map((e, i) => (
          <button
            key={e + i}
            onClick={() => onPick(e)}
            className="w-8 h-8 flex items-center justify-center text-xl hover:bg-white/[0.06] rounded-lg transition-colors"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Chat panel ──────────────────────────────────────────────────────────────
export function ChatPanel({
  messages,
  onSend,
  onClose,
  localParticipantId,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [picker, setPicker] = useState<'emoji' | 'sticker' | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (text?: string) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed) return
    onSend(trimmed)
    if (!text) setInput('')
  }

  // Emoji picker: insert into input rather than send immediately
  const handlePickEmoji = (e: string) => {
    setInput(prev => prev + e)
    inputRef.current?.focus()
  }

  // Sticker picker: send immediately
  const handlePickSticker = (s: string) => {
    handleSend(s)
    setPicker(null)
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
                <p className="text-xs text-[#3a3a50] mt-1">Send a sticker to get started!</p>
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

      {/* Picker */}
      <AnimatePresence>
        {picker && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            <Picker
              mode={picker}
              onPick={picker === 'sticker' ? handlePickSticker : handlePickEmoji}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border:     '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <button
            onClick={() => setPicker(picker === 'emoji' ? null : 'emoji')}
            className={cn(
              'shrink-0 transition-colors',
              picker === 'emoji' ? 'text-[#c9a84c]' : 'text-[#5a5a72] hover:text-[#9090a8]',
            )}
            title="Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          <button
            onClick={() => setPicker(picker === 'sticker' ? null : 'sticker')}
            className={cn(
              'shrink-0 transition-colors',
              picker === 'sticker' ? 'text-[#c9a84c]' : 'text-[#5a5a72] hover:text-[#9090a8]',
            )}
            title="Stickers"
          >
            <Sticker className="w-4 h-4" />
          </button>

          <input
            ref={inputRef}
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
            onClick={() => handleSend()}
            disabled={!input.trim()}
            whileTap={{ scale: 0.9 }}
            className="shrink-0 p-1.5 rounded-lg transition-all duration-200 disabled:opacity-30"
            style={{
              background: input.trim() ? 'rgba(201,168,76,0.2)' : 'transparent',
              color:      input.trim() ? '#c9a84c' : '#5a5a72',
            }}
          >
            <Send className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
