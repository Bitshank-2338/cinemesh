'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { Zap, ArrowRight, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CTA() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section ref={ref} className="relative py-40 px-6 overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(201,168,76,0.08) 0%, rgba(59,130,246,0.05) 40%, transparent 70%)',
        }}
      />

      {/* Animated rings */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border pointer-events-none"
          style={{
            width: `${i * 280 + 100}px`,
            height: `${i * 280 + 100}px`,
            borderColor: `rgba(201,168,76,${0.08 / i})`,
          }}
          animate={{ scale: [0.95, 1.05, 0.95], rotate: [0, i % 2 === 0 ? 180 : -180] }}
          transition={{ duration: 20 + i * 5, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Icon */}
        <motion.div
          className="mx-auto mb-8 w-20 h-20 rounded-3xl flex items-center justify-center relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#d4a843] to-[#b89040] rounded-3xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#d4a843] to-[#b89040] rounded-3xl blur-2xl opacity-50" />
          <Film className="relative w-9 h-9 text-[#0a0808] z-10" />
        </motion.div>

        {/* Headline */}
        <motion.h2
          className="clamp-display font-display font-bold text-[#f0f0f4] mb-6"
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          Your next movie night
          <br />
          <span className="text-gradient-gold">starts right now</span>
        </motion.h2>

        {/* Sub */}
        <motion.p
          className="text-base text-[#7070a0] max-w-xl mx-auto mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          No sign-up required. Create a room, share the link, and watch together
          in under 30 seconds. Free for rooms up to 6 people.
        </motion.p>

        {/* Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <Link href="/create">
            <Button variant="primary" size="xl" icon={Zap} glow>
              Create a Free Room
            </Button>
          </Link>
          <Link href="/join">
            <Button variant="ghost" size="xl" icon={ArrowRight} iconPosition="right">
              Join Existing Room
            </Button>
          </Link>
        </motion.div>

        {/* Fine print */}
        <motion.p
          className="mt-6 text-xs text-[#4a4a60]"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.4 }}
        >
          No credit card · No download · Works in any browser
        </motion.p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────
export function Footer() {
  return (
    <footer className="relative py-12 px-6 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#c9a84c] flex items-center justify-center">
            <Film className="w-3.5 h-3.5 text-[#0a0808]" />
          </div>
          <span className="font-display font-bold text-[#f0f0f4]">CineMesh</span>
        </div>

        <nav className="flex gap-6">
          {['Privacy', 'Terms', 'Status', 'GitHub'].map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm text-[#5a5a72] hover:text-[#9090a8] transition-colors"
            >
              {link}
            </a>
          ))}
        </nav>

        <p className="text-xs text-[#3a3a50]">
          © {new Date().getFullYear()} CineMesh. Watch responsibly.
        </p>
      </div>
    </footer>
  )
}
