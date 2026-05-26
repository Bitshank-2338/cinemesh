'use client'

import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// ─── Floating Orbs ────────────────────────────────────────────────
interface OrbProps {
  color: string
  size: number
  x: string
  y: string
  delay?: number
  duration?: number
  opacity?: number
}

function Orb({ color, size, x, y, delay = 0, duration = 12, opacity = 0.35 }: OrbProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: `blur(${size * 0.4}px)`,
        opacity,
      }}
      animate={reduced ? {} : {
        x: [0, 40, -20, 0],
        y: [0, -50, 25, 0],
        scale: [1, 1.1, 0.95, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatType: 'mirror',
        ease: 'easeInOut',
      }}
    />
  )
}

// ─── Grid Lines ───────────────────────────────────────────────────
function GridLines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }}
    />
  )
}

// ─── Noise Texture ────────────────────────────────────────────────
function NoiseTexture() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.025]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '256px 256px',
      }}
    />
  )
}

// ─── Cinematic Vignette ───────────────────────────────────────────
function Vignette() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(4,4,12,0.7) 100%)',
      }}
    />
  )
}

// ─── Main Component ───────────────────────────────────────────────
interface AmbientBackgroundProps {
  variant?: 'landing' | 'room' | 'lobby' | 'minimal'
  className?: string
}

export function AmbientBackground({
  variant = 'landing',
  className = '',
}: AmbientBackgroundProps) {
  const reduced = useReducedMotion()

  const orbConfigs: Record<string, OrbProps[]> = {
    landing: [
      { color: 'rgba(201,168,76,0.6)',  size: 600, x: '-10%', y: '-15%', delay: 0,   duration: 14, opacity: 0.35 },
      { color: 'rgba(59,130,246,0.5)',  size: 500, x: '70%',  y: '10%',  delay: 2,   duration: 16, opacity: 0.30 },
      { color: 'rgba(139,92,246,0.35)', size: 350, x: '20%',  y: '60%',  delay: 4,   duration: 12, opacity: 0.25 },
      { color: 'rgba(201,168,76,0.25)', size: 250, x: '80%',  y: '70%',  delay: 1,   duration: 18, opacity: 0.20 },
    ],
    room: [
      { color: 'rgba(59,130,246,0.4)',  size: 400, x: '-5%',  y: '-10%', delay: 0, duration: 16, opacity: 0.25 },
      { color: 'rgba(139,92,246,0.3)',  size: 300, x: '75%',  y: '60%',  delay: 3, duration: 14, opacity: 0.20 },
    ],
    lobby: [
      { color: 'rgba(201,168,76,0.4)',  size: 450, x: '50%',  y: '-5%',  delay: 0, duration: 15, opacity: 0.30 },
      { color: 'rgba(59,130,246,0.3)',  size: 300, x: '10%',  y: '70%',  delay: 2, duration: 13, opacity: 0.22 },
    ],
    minimal: [
      { color: 'rgba(201,168,76,0.2)',  size: 400, x: '50%',  y: '50%',  delay: 0, duration: 20, opacity: 0.18 },
    ],
  }

  const orbs = orbConfigs[variant]

  return (
    <div className={`fixed inset-0 overflow-hidden pointer-events-none ${className}`} style={{ zIndex: 0 }}>
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: variant === 'room'
            ? 'radial-gradient(ellipse 80% 60% at 50% -10%, #0d0d22 0%, #06060e 60%)'
            : 'radial-gradient(ellipse 100% 80% at 50% -20%, #0d1020 0%, #06060e 50%)',
        }}
      />

      {/* Orbs */}
      {orbs.map((orb, i) => (
        <Orb key={i} {...orb} opacity={reduced ? (orb.opacity ?? 0.35) * 0.5 : (orb.opacity ?? 0.35)} />
      ))}

      {/* Grid */}
      {variant !== 'minimal' && <GridLines />}

      {/* Noise */}
      <NoiseTexture />

      {/* Vignette */}
      <Vignette />
    </div>
  )
}

// ─── Scan Line Sweep (used in room) ──────────────────────────────
export function ScanLine() {
  const reduced = useReducedMotion()
  if (reduced) return null

  return (
    <motion.div
      className="absolute left-0 right-0 h-px pointer-events-none"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.4) 50%, transparent 100%)',
        zIndex: 10,
      }}
      animate={{ top: ['-2px', '100vh'] }}
      transition={{
        duration: 8,
        repeat: Infinity,
        repeatDelay: 12,
        ease: 'linear',
      }}
    />
  )
}
