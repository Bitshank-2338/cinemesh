'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Video,
  MessageSquare,
  Zap,
  Monitor,
  Users,
  Lock,
  Wifi,
  Heart,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { staggerBase, fadeUp } from '@/lib/motion'

const features = [
  {
    icon: Zap,
    title: 'Frame-perfect sync',
    description: 'Sub-50ms latency keeps everyone on the exact same frame. Pause, seek, rewind — it all propagates instantly.',
    accent: '#c9a84c',
    badge: 'Core',
  },
  {
    icon: Video,
    title: 'HD Video calls',
    description: 'WebRTC-powered video with adaptive bitrate. See every reaction, every gasp, every look of horror.',
    accent: '#3b82f6',
    badge: 'WebRTC',
  },
  {
    icon: MessageSquare,
    title: 'Live chat',
    description: 'React, comment, and use emoji in real-time. The group chat that belongs next to the screen.',
    accent: '#a78bfa',
    badge: 'Realtime',
  },
  {
    icon: Monitor,
    title: 'Screen sharing',
    description: 'Share your screen when you want. Built for flexibility — your screen, your rules.',
    accent: '#34d399',
    badge: 'Native',
  },
  {
    icon: Users,
    title: 'Up to 50 viewers',
    description: 'From date night for two to a full friend group premiere. Scale your room as big as the occasion.',
    accent: '#f472b6',
    badge: 'Groups',
  },
  {
    icon: Lock,
    title: 'Private rooms',
    description: 'Password-protected rooms. Share the link with who you want, and only who you want.',
    accent: '#fb923c',
    badge: 'Security',
  },
  {
    icon: Wifi,
    title: 'Low-bandwidth mode',
    description: 'Adaptive streaming that works even on slower connections. No one gets left behind.',
    accent: '#22d3ee',
    badge: 'Adaptive',
  },
  {
    icon: Heart,
    title: 'Reaction system',
    description: 'Floating emoji reactions that appear on screen in real-time. Let the moment hit together.',
    accent: '#f87171',
    badge: 'Fun',
  },
]

function FeatureCard({
  feature,
  index,
}: {
  feature: typeof features[number]
  index: number
}) {
  const Icon = feature.icon

  return (
    <motion.div variants={fadeUp}>
      <GlassCard
        hover
        glow="none"
        padding="lg"
        rounded="xl"
        className="group h-full cursor-default"
        style={{
          '--accent': feature.accent,
        } as React.CSSProperties}
      >
        {/* Icon */}
        <div className="mb-5">
          <div
            className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: `${feature.accent}18`,
              border: `1px solid ${feature.accent}28`,
            }}
          >
            <Icon
              className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
              style={{ color: feature.accent }}
            />
            {/* Glow on hover */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg"
              style={{ background: `${feature.accent}30` }}
            />
          </div>
        </div>

        {/* Badge */}
        <div className="mb-3">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md"
            style={{
              color: feature.accent,
              background: `${feature.accent}14`,
            }}
          >
            {feature.badge}
          </span>
        </div>

        {/* Content */}
        <h3 className="font-display font-bold text-[1.0625rem] text-[#f0f0f4] mb-2 leading-snug">
          {feature.title}
        </h3>
        <p className="text-sm text-[#7070a0] leading-relaxed">
          {feature.description}
        </p>

        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 left-6 right-6 h-px rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(90deg, transparent, ${feature.accent}60, transparent)`,
          }}
        />
      </GlassCard>
    </motion.div>
  )
}

export function Features() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section
      id="features"
      ref={ref}
      className="relative py-32 px-6 overflow-hidden"
    >
      {/* Section divider glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(201,168,76,0.4), transparent)',
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#c9a84c] mb-4 block">
            What's included
          </span>
          <h2 className="clamp-display font-display font-bold text-[#f0f0f4] mb-4">
            Built for the{' '}
            <span className="text-gradient-blue">real movie experience</span>
          </h2>
          <p className="text-[#7070a0] text-base max-w-2xl mx-auto leading-relaxed">
            Everything you need to make watching together feel like you're in the same room.
            Nothing you don't.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={staggerBase}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
