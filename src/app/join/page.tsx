'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Film, ArrowLeft, Hash, Users, ArrowRight } from 'lucide-react'
import { AmbientBackground } from '@/components/ui/ambient-background'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlassCard } from '@/components/ui/glass-card'
import { pageTransition } from '@/lib/motion'
import { getRoomByCode } from '@/lib/room-service'
import { isSupabaseConfigured } from '@/lib/supabase'

const formatCode = (val: string) =>
  val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)

export default function JoinPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // Pre-fill the code if the invite link included ?code=XYZ
  const [code,        setCode]        = useState(() => formatCode(searchParams.get('code') ?? ''))
  const [displayName, setDisplayName] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [codeError,   setCodeError]   = useState(() => {
    const err = searchParams.get('err')
    if (err === 'notfound') return 'That room doesn\'t exist or has expired. Double-check the code with your host.'
    if (err === 'kicked') {
      const by = searchParams.get('by')
      return by
        ? `${decodeURIComponent(by)} removed you from the room.`
        : 'You were removed from the room by the host.'
    }
    return ''
  })

  // If the user lands mid-render without searchParams (SSR), sync once
  useEffect(() => {
    const preCode = formatCode(searchParams.get('code') ?? '')
    if (preCode && !code) setCode(preCode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleJoin = async () => {
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length < 4) {
      setCodeError('Enter a valid room code')
      return
    }
    if (!displayName.trim()) return

    setLoading(true)
    setCodeError('')

    if (isSupabaseConfigured()) {
      const result = await getRoomByCode(cleaned)
      if (!result.ok) {
        setCodeError('Could not reach server. Please try again.')
        setLoading(false)
        return
      }
      if (!result.data) {
        setCodeError('That code doesn\'t match any active room. Check with your host.')
        setLoading(false)
        return
      }

      // Pass room UUID (dbId) and room name so lobby can do correct DB ops
      router.push(
        `/lobby/${cleaned}` +
        `?display=${encodeURIComponent(displayName)}` +
        `&name=${encodeURIComponent(result.data.name)}` +
        `&dbId=${result.data.id}`,
      )
      return
    }

    // Local mode (no Supabase) — skip validation
    router.push(`/lobby/${cleaned}?display=${encodeURIComponent(displayName)}`)
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <AmbientBackground variant="lobby" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#c9a84c] flex items-center justify-center">
            <Film className="w-4 h-4 text-[#0a0808]" />
          </div>
          <span className="font-display font-bold text-lg text-gradient-gold">CineMesh</span>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm" icon={ArrowLeft}>Back</Button>
        </Link>
      </header>

      <motion.main
        className="relative z-10 flex-1 flex items-center justify-center px-6 py-12"
        variants={pageTransition}
        initial="initial"
        animate="animate"
      >
        <div className="w-full max-w-md">
          <GlassCard padding="xl" rounded="2xl">
            <div className="mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.2)] flex items-center justify-center mb-5">
                <Hash className="w-6 h-6 text-[#60a5fa]" />
              </div>
              <h1 className="clamp-title font-display font-bold text-[#f0f0f4] mb-2">
                Join a room
              </h1>
              <p className="text-sm text-[#7070a0]">
                Enter the code your host shared with you.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-[#9090a8] uppercase tracking-widest mb-2 block">
                  Room code
                </label>
                <input
                  type="text"
                  placeholder="ABC123"
                  value={code}
                  onChange={(e) => {
                    setCode(formatCode(e.target.value))
                    setCodeError('')
                  }}
                  className="w-full h-16 px-5 text-2xl font-bold font-mono text-center tracking-[0.3em] rounded-2xl border transition-all duration-200 outline-none uppercase"
                  style={{
                    background:  'rgba(255,255,255,0.05)',
                    borderColor: codeError
                      ? 'rgba(239,68,68,0.5)'
                      : code.length > 0
                      ? 'rgba(59,130,246,0.4)'
                      : 'rgba(255,255,255,0.1)',
                    color: '#f0f0f4',
                    letterSpacing: '0.3em',
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  autoFocus={!code}  // only auto-focus when code isn't pre-filled
                />
                {codeError && (
                  <p className="text-sm text-red-400 mt-2 font-medium">{codeError}</p>
                )}
              </div>

              <Input
                label="Your display name"
                placeholder="Mia 🍿"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                size="lg"
                icon={<Users className="w-4 h-4" />}
                autoFocus={!!code}  // focus name if code is pre-filled
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />

              <Button
                variant="primary"
                size="lg"
                fullWidth
                icon={ArrowRight}
                iconPosition="right"
                loading={loading}
                disabled={code.length < 4 || !displayName.trim()}
                onClick={handleJoin}
                glow
              >
                {loading ? 'Checking room…' : 'Join Room'}
              </Button>

              <p className="text-center text-sm text-[#5a5a72]">
                Don&apos;t have a code?{' '}
                <Link href="/create" className="text-[#c9a84c] hover:text-[#e6c46a] transition-colors">
                  Create a room
                </Link>
              </p>
            </div>
          </GlassCard>
        </div>
      </motion.main>
    </div>
  )
}
