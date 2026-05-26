'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Film, ArrowLeft, Home } from 'lucide-react'
import { AmbientBackground } from '@/components/ui/ambient-background'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-6">
      <AmbientBackground variant="minimal" />

      <div className="relative z-10 text-center max-w-lg">
        {/* Big 404 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <p
            className="font-display font-bold text-[#1a1a30]"
            style={{ fontSize: 'clamp(8rem, 20vw, 14rem)', lineHeight: 1 }}
          >
            404
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4a843] to-[#c9a84c] flex items-center justify-center mx-auto mb-6">
            <Film className="w-7 h-7 text-[#0a0808]" />
          </div>

          <h1 className="font-display font-bold text-2xl text-[#f0f0f4] mb-3">
            This scene doesn't exist
          </h1>
          <p className="text-[#7070a0] text-base mb-8 leading-relaxed">
            The room or page you're looking for has ended, moved, or never existed.
            The credits have rolled.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button variant="primary" size="lg" icon={Home} glow>
                Back to home
              </Button>
            </Link>
            <Link href="/create">
              <Button variant="ghost" size="lg">
                Create a new room
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
