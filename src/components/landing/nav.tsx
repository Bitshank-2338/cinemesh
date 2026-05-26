'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Film, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()

  useEffect(() => {
    const unsub = scrollY.on('change', (v) => setScrolled(v > 40))
    return unsub
  }, [scrollY])

  return (
    <motion.header
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'transition-all duration-500',
        scrolled
          ? 'py-3 bg-[rgba(6,6,14,0.85)] backdrop-blur-2xl border-b border-white/[0.07]'
          : 'py-5 bg-transparent'
      )}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <nav className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-[#d4a843] to-[#c9a84c] rounded-xl opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#d4a843] to-[#c9a84c] rounded-xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
            <Film className="relative w-4 h-4 text-[#0a0808] z-10" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-gradient-gold">
            CineMesh
          </span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'How it works', 'Pricing'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-sm font-medium text-[#9090a8] hover:text-[#f0f0f4] transition-colors duration-200"
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
            Sign in
          </Button>
          <Link href="/create">
            <Button variant="primary" size="sm" icon={Zap}>
              Start a Room
            </Button>
          </Link>
        </div>
      </nav>
    </motion.header>
  )
}
