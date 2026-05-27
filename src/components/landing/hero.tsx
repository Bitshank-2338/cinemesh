'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  motion,
  useReducedMotion,
} from 'framer-motion'
import {
  ArrowRight,
  Play,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fadeUp } from '@/lib/motion'

// ─── Floating Video Card ──────────────────────────────────────────
function FloatingParticipantCard({
  name,
  emoji,
  x,
  y,
  delay,
}: {
  name: string
  emoji: string
  x: string
  y: string
  delay: number
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className="absolute hidden lg:flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl select-none pointer-events-none"
      style={{
        left: x,
        top: y,
        background: 'rgba(12,12,24,0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={
        reduced
          ? { opacity: 0.9, scale: 1, y: 0 }
          : {
              opacity: [0, 0.9, 0.9, 0.9],
              scale: [0.8, 1, 1, 1],
              y: [20, 0, -8, 0],
            }
      }
      transition={
        reduced
          ? { duration: 0.5, delay }
          : {
              duration: 6,
              delay,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut',
              times: [0, 0.1, 0.5, 1],
            }
      }
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-sm">
        {emoji}
      </div>
      <div>
        <p className="text-xs font-semibold text-[#f0f0f4] leading-tight">{name}</p>
        <p className="text-[10px] text-[#5a5a72] leading-tight flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse" />
          Watching
        </p>
      </div>
    </motion.div>
  )
}

// ─── Cinema Screen Preview ────────────────────────────────────────
function CinemaPreview() {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className="relative mx-auto w-full max-w-3xl"
      initial={{ opacity: 0, y: 60, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Glow behind screen */}
      <div
        className="absolute -inset-10 rounded-[3rem] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 60%, rgba(59,130,246,0.2) 0%, rgba(201,168,76,0.1) 50%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Screen bezel */}
      <div
        className="relative rounded-[1.5rem] overflow-hidden"
        style={{
          background: 'rgba(10,10,20,0.9)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-3 py-1 rounded-md bg-white/[0.05] text-[11px] text-[#5a5a72] font-mono">
              cinemesh.app/room/MOVIE-NIGHT
            </div>
          </div>
        </div>

        {/* Room layout preview */}
        <div className="flex h-[340px]">
          {/* Main video area */}
          <div className="flex-1 relative bg-gradient-to-br from-[#080818] to-[#060610] flex items-center justify-center">
            {/* Fake movie content */}
            <div className="absolute inset-0 opacity-30"
              style={{
                background: 'linear-gradient(135deg, #1a0a30 0%, #0a1a40 40%, #001a20 100%)',
              }}
            />

            {/* Film grain */}
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E")`,
              }}
            />

            {/* Play state indicator */}
            <motion.div
              className="relative z-10 flex items-center gap-3"
              animate={reduced ? {} : { opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Play className="w-6 h-6 text-white/80 ml-0.5" fill="currentColor" />
              </div>
            </motion.div>

            {/* Sync indicator */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/[0.08]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] text-[#9090a8]">Synced · 3 watching</span>
            </div>

            {/* Playback bar */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
            >
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#c9a84c] to-[#3b82f6] rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '38%' }}
                  transition={{ duration: 1.5, delay: 1 }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-[#5a5a72]">42:18</span>
                <span className="text-[10px] text-[#5a5a72]">1:52:04</span>
              </div>
            </div>
          </div>

          {/* Chat sidebar */}
          <div className="w-52 border-l border-white/[0.06] flex flex-col bg-[rgba(8,8,18,0.7)]">
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-[11px] font-semibold text-[#9090a8] uppercase tracking-widest">Chat</p>
            </div>
            <div className="flex-1 overflow-hidden px-3 py-2 space-y-2">
              {[
                { name: 'Alex', msg: 'omg this scene 😱', color: 'text-[#c9a84c]' },
                { name: 'Mia', msg: 'I told you!!!', color: 'text-[#60a5fa]' },
                { name: 'Jay', msg: 'best part ngl', color: 'text-[#a78bfa]' },
                { name: 'Alex', msg: '🍿🍿🍿', color: 'text-[#c9a84c]' },
              ].map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.15 }}
                  className="flex gap-1.5"
                >
                  <span className={`text-[10px] font-bold ${m.color} shrink-0`}>{m.name}</span>
                  <span className="text-[10px] text-[#7070a0] leading-snug">{m.msg}</span>
                </motion.div>
              ))}
            </div>

            {/* Participants */}
            <div className="border-t border-white/[0.06] px-3 py-2">
              <div className="flex -space-x-1.5">
                {['🎬', '🍿', '✨', '🎭'].map((e, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-[#c9a84c]/40 to-[#3b82f6]/40 border border-white/20 flex items-center justify-center text-[10px]"
                  >
                    {e}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards */}
      <FloatingParticipantCard name="Alex" emoji="🎬" x="-8%" y="20%" delay={0.8} />
      <FloatingParticipantCard name="Mia"  emoji="🍿" x="105%" y="30%" delay={1.2} />
      <FloatingParticipantCard name="Jay"  emoji="✨" x="-6%" y="65%" delay={1.6} />
    </motion.div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────
export function Hero() {
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-20 px-6 overflow-hidden"
    >
      <div
        className="relative z-10 w-full max-w-7xl mx-auto flex flex-col items-center"
        style={{ opacity: mounted ? 1 : 1 }}
      >
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-8"
        >
          <Badge variant="gold" dot size="md" className="text-sm">
            Now in early access · Free forever for small rooms
          </Badge>
        </motion.div>

        {/* Headline */}
        <div className="text-center mb-6 overflow-hidden">
          <motion.h1
            className="clamp-hero font-display font-bold text-[#f0f0f4] leading-none tracking-tight"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            Watch together.
          </motion.h1>
          <motion.h1
            className="clamp-hero font-display font-bold leading-none tracking-tight"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-gradient-gold">Feel together.</span>
          </motion.h1>
        </div>

        {/* Subheadline */}
        <motion.p
          className="text-center text-base sm:text-lg text-[#7070a0] max-w-xl leading-relaxed mb-10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          Create a room, share the link, and experience every reaction together —
          real-time video, chat, and perfectly synced playback.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 mb-6"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          <Link href="/create">
            <Button variant="primary" size="xl" icon={Zap} glow className="text-base">
              Create a Room
            </Button>
          </Link>
          <Link href="/join">
            <Button variant="ghost" size="xl" icon={ArrowRight} iconPosition="right" className="text-base">
              Join with Code
            </Button>
          </Link>
        </motion.div>

        {/* Spacer */}
        <div className="mb-20" />

        {/* Screen preview */}
        <CinemaPreview />
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, #06060e)',
        }}
      />
    </section>
  )
}
