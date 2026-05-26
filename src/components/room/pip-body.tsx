'use client'

/**
 * PipBody — the contents rendered INSIDE the floating PiP window.
 *
 * Kept intentionally lean (no Framer Motion, no AnimatePresence) because the
 * components run inside a separate window document where animations can be
 * janky and unnecessary. Uses plain Tailwind only.
 */

import { useEffect, useRef, useState } from 'react'
import { Send, Smile, Sticker, X } from 'lucide-react'
import type { ChatPayload } from '@/lib/channel'
import type { RoomParticipant } from '@/hooks/use-room-channel'
import type { PeerConnectionState } from '@/hooks/use-webrtc'
import { getInitials, cn } from '@/lib/utils'

// ─── Same emoji/sticker catalogues as the main chat ──────────────────────
const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  { label: 'Movie',  icon: '🎬', emojis: ['🎬','🎥','🎞️','📽️','🎟️','🍿','🎭','🎤','🎧','🎵','🎶','🍔','🍕','🍟','🌮','🍣','🍩','🍪','🍰','🧁','🍫','🍦','🥤','🍷','🍺','🍸','🥂','🥃'] },
  { label: 'Faces',  icon: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😋','😛','😜','🤪','😝','🤗','🤭','🤔','😐','😑','😶','😏','🙄','😬','🤥','😴','🤤','😪','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😲','😳','🥺','😨','😰','😢','😭','😱','😣','😔','😖','😩','😫','🥱','😤','😡','😠','🤬'] },
  { label: 'Hearts', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','💌','🌹','🌷','🌻','🌸','🌺','💐','✨','💫','⭐','🌟'] },
  { label: 'Hands',  icon: '👍', emojis: ['👍','👎','👏','🙌','👐','🤲','🤝','🙏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐️','✋','🖖','💪','🤳','🫰','🫶'] },
  { label: 'Symbols',icon: '🔥', emojis: ['🔥','💯','💢','💥','💫','⚡','💎','🏆','🥇','🎉','🎊','🎈','🎁','🎀','✅','❌','⭕','❗','❓','‼️','⁉️','💯','🆗','🆒','🆕','🔝'] },
]

const STICKERS = ['🍿🎬','🎬✨','🎥🔥','👀🍿','😂🤣','😱😱','❤️🔥','🥺👉👈','🎉🥳','💯💯','🤝👏','🚀🌙','☕💤','🌃✨','👑😎','🤯🤯','😍😍','🎀💖','👻🎃','🌸🌸','🍕🍔','🍷🥂','🦋🌷','🎶🎵']

function isStickerMessage(c: string): boolean {
  if (c.startsWith('STK:')) return true
  const stripped = c.replace(/\s/g, '')
  if (!stripped.length || stripped.length > 12) return false
  return !/[a-zA-Z0-9]/.test(stripped)
}

// ─── Tile (no animation, pure HTML video) ─────────────────────────────────
function MiniTile({
  participant,
  stream,
  isLocal,
  connectionState,
}: {
  participant: RoomParticipant
  stream: MediaStream | null
  isLocal: boolean
  connectionState?: PeerConnectionState
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !stream) return
    el.srcObject = stream
    el.muted = isLocal
    el.play().catch(() => {})
    return () => { el.srcObject = null }
  }, [stream, isLocal])

  const hasVideo = stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')
  const showVideo = hasVideo && !participant.isCameraOff
  const disconnected = connectionState === 'failed' || connectionState === 'disconnected'

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-[#0a0a18] border border-white/10">
      {showVideo && stream ? (
        <video ref={ref} autoPlay playsInline muted={isLocal} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#0a0a18]">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#3b82f6] flex items-center justify-center text-xs font-bold text-white">
            {getInitials(participant.name)}
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-[10px] font-semibold text-white truncate">
          {isLocal ? `${participant.name} (you)` : participant.name}
        </span>
        {participant.isMuted && <span className="text-[9px] text-red-400">🔇</span>}
      </div>
      {disconnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] text-red-400">
          Reconnecting
        </div>
      )}
    </div>
  )
}

// ─── Picker (collapsible) ─────────────────────────────────────────────────
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
      <div className="px-3 py-2 border-t border-white/10">
        <p className="text-[9px] uppercase tracking-widest text-[#5a5a72] mb-1.5 font-bold">Stickers</p>
        <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
          {STICKERS.map(s => (
            <button
              key={s}
              onClick={() => onPick('STK:' + s)}
              className="aspect-square rounded-lg flex items-center justify-center text-lg bg-white/5 border border-white/5 hover:bg-white/10"
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
    <div className="px-2 py-2 border-t border-white/10">
      <div className="flex gap-1 mb-1.5 overflow-x-auto">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.label}
            onClick={() => setCat(i)}
            className={cn('shrink-0 px-2 py-0.5 rounded text-sm', i === cat ? 'bg-white/15' : 'hover:bg-white/5')}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 max-h-32 overflow-y-auto">
        {active.emojis.map((e, i) => (
          <button
            key={e + i}
            onClick={() => onPick(e)}
            className="w-7 h-7 flex items-center justify-center text-base hover:bg-white/10 rounded"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main PiP body ────────────────────────────────────────────────────────
interface PipBodyProps {
  localParticipant:   RoomParticipant
  remoteParticipants: RoomParticipant[]
  localCamStream:     MediaStream | null
  remoteCameras:      Record<string, MediaStream>
  connectionStates:   Record<string, PeerConnectionState>
  messages:           ChatPayload[]
  onSend:             (s: string) => void
  localParticipantId: string
  onPopBack:          () => void
}

export function PipBody({
  localParticipant,
  remoteParticipants,
  localCamStream,
  remoteCameras,
  connectionStates,
  messages,
  onSend,
  localParticipantId,
  onPopBack,
}: PipBodyProps) {
  const [input, setInput]   = useState('')
  const [picker, setPicker] = useState<'emoji' | 'sticker' | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const send = (txt?: string) => {
    const t = (txt ?? input).trim()
    if (!t) return
    onSend(t)
    if (!txt) setInput('')
  }

  const realMessages = messages.filter(m => m.type !== 'system')

  return (
    <div className="flex flex-col h-screen w-screen">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-base">🎬</span>
          <span className="text-sm font-bold text-[#c9a84c]">CineMesh PiP</span>
          <span className="text-[10px] text-[#5a5a72]">
            · {1 + remoteParticipants.length} {remoteParticipants.length === 0 ? 'person' : 'people'}
          </span>
        </div>
        <button
          onClick={onPopBack}
          className="p-1 rounded-md text-[#9090a8] hover:text-white hover:bg-white/10"
          title="Close floating window"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Cam grid — local + remote */}
      <div className="shrink-0 grid grid-cols-2 gap-1.5 p-2 border-b border-white/10 max-h-[40vh] overflow-y-auto">
        <MiniTile participant={localParticipant} stream={localCamStream} isLocal />
        {remoteParticipants.map(p => (
          <MiniTile
            key={p.participantId}
            participant={p}
            stream={remoteCameras[p.participantId] ?? null}
            isLocal={false}
            connectionState={connectionStates[p.participantId]}
          />
        ))}
        {remoteParticipants.length === 0 && (
          <div className="aspect-video rounded-lg flex items-center justify-center text-[10px] text-[#5a5a72] bg-white/3 border border-dashed border-white/10">
            Waiting for others…
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {realMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8 gap-2">
            <span className="text-2xl">💬</span>
            <p className="text-xs text-[#5a5a72]">No messages yet</p>
            <p className="text-[10px] text-[#3a3a50]">Stickers and emojis still work here</p>
          </div>
        ) : realMessages.map(m => {
          const isLocal  = m.participantId === localParticipantId
          const sticker  = isStickerMessage(m.content)
          const content  = m.content.startsWith('STK:') ? m.content.slice(4) : m.content
          return (
            <div key={m.id} className={cn('flex flex-col', isLocal && 'items-end')}>
              <div className="text-[9px] text-[#5a5a72] mb-0.5">
                {isLocal ? 'You' : m.participantName}
              </div>
              {sticker ? (
                <span className="text-2xl">{content}</span>
              ) : (
                <div
                  className={cn('px-2 py-1 rounded-lg text-xs max-w-[90%]', isLocal ? 'bg-[#c9a84c]/15 border border-[#c9a84c]/30' : 'bg-white/5 border border-white/10')}
                  style={{ color: '#e0e0ec' }}
                >
                  {content}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Picker */}
      {picker && (
        <Picker mode={picker} onPick={(s) => {
          if (picker === 'sticker') { send(s); setPicker(null) }
          else setInput(prev => prev + s)
        }} />
      )}

      {/* Input */}
      <div className="shrink-0 px-2 py-2 border-t border-white/10 bg-black/30">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <button
            onClick={() => setPicker(picker === 'emoji' ? null : 'emoji')}
            className={cn('shrink-0', picker === 'emoji' ? 'text-[#c9a84c]' : 'text-[#5a5a72] hover:text-white')}
            title="Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPicker(picker === 'sticker' ? null : 'sticker')}
            className={cn('shrink-0', picker === 'sticker' ? 'text-[#c9a84c]' : 'text-[#5a5a72] hover:text-white')}
            title="Stickers"
          >
            <Sticker className="w-4 h-4" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
            placeholder="Message…"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-[#3a3a50] outline-none"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim()}
            className="shrink-0 p-1 rounded-md text-[#c9a84c] disabled:opacity-30 hover:bg-white/10"
            title="Send"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
