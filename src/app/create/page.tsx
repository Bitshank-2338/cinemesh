'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film,
  ArrowLeft,
  Lock,
  Users,
  Globe,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { AmbientBackground } from '@/components/ui/ambient-background'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlassCard } from '@/components/ui/glass-card'
import { pageTransition, staggerBase, fadeUp } from '@/lib/motion'
import { createRoom } from '@/lib/room-service'

type RoomType = 'public' | 'private'

const roomTypeOptions = [
  {
    id: 'private' as RoomType,
    icon: Lock,
    label: 'Private',
    description: 'Password protected. Only invited friends can join.',
    recommended: true,
  },
  {
    id: 'public' as RoomType,
    icon: Globe,
    label: 'Public',
    description: 'Anyone with the link can join. Great for open screenings.',
    recommended: false,
  },
]

export default function CreatePage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [roomName, setRoomName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [roomType, setRoomType] = useState<RoomType>('private')
  const [password, setPassword] = useState('')
  const [maxPeople, setMaxPeople] = useState(6)
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [createError, setCreateError] = useState('')

  const handleStep1 = () => {
    if (!roomName.trim()) {
      setNameError('Give your room a name')
      return
    }
    setNameError('')
    setStep(2)
  }

  const handleCreate = async () => {
    if (!displayName.trim()) return
    setLoading(true)
    setCreateError('')

    // Stable participant ID for this host
    const hostId = `host_${crypto.randomUUID().slice(0, 8)}`

    const result = await createRoom({
      name:       roomName,
      hostId,
      maxMembers: maxPeople,
    })

    if (!result.ok) {
      setCreateError(result.error)
      setLoading(false)
      return
    }

    router.push(
      `/lobby/${result.data.code}` +
      `?name=${encodeURIComponent(roomName)}` +
      `&host=true` +
      `&display=${encodeURIComponent(displayName)}` +
      `&pid=${hostId}` +
      `&dbId=${result.data.id}`,
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <AmbientBackground variant="lobby" />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#d4a843] to-[#c9a84c] flex items-center justify-center">
            <Film className="w-4 h-4 text-[#0a0808]" />
          </div>
          <span className="font-display font-bold text-lg text-gradient-gold">CineMesh</span>
        </Link>

        <Link href="/">
          <Button variant="ghost" size="sm" icon={ArrowLeft}>
            Back
          </Button>
        </Link>
      </header>

      {/* Main */}
      <motion.main
        className="relative z-10 flex-1 flex items-center justify-center px-6 py-12"
        variants={pageTransition}
        initial="initial"
        animate="animate"
      >
        <div className="w-full max-w-lg">
          {/* Progress */}
          <div className="flex items-center gap-3 mb-10">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                  style={{
                    background: step >= s ? '#c9a84c' : 'rgba(255,255,255,0.06)',
                    color: step >= s ? '#0a0808' : '#5a5a72',
                    boxShadow: step === s ? '0 0 20px rgba(201,168,76,0.4)' : 'none',
                  }}
                >
                  {s}
                </div>
                {s < 2 && (
                  <div
                    className="flex-1 h-px w-12 transition-all duration-500"
                    style={{
                      background: step > s
                        ? 'linear-gradient(90deg, #c9a84c, #3b82f6)'
                        : 'rgba(255,255,255,0.08)',
                    }}
                  />
                )}
              </div>
            ))}
            <span className="ml-2 text-sm text-[#5a5a72]">
              {step === 1 ? 'Room details' : 'Your profile'}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <GlassCard padding="xl" rounded="2xl">
                  <div className="mb-8">
                    <h1 className="clamp-title font-display font-bold text-[#f0f0f4] mb-2">
                      Create your room
                    </h1>
                    <p className="text-sm text-[#7070a0]">
                      Set up your private cinema. Takes 10 seconds.
                    </p>
                  </div>

                  <motion.div
                    className="space-y-6"
                    variants={staggerBase}
                    initial="hidden"
                    animate="visible"
                  >
                    <motion.div variants={fadeUp}>
                      <Input
                        label="Room name"
                        placeholder="Friday Movie Night 🎬"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        error={nameError}
                        size="lg"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                      />
                    </motion.div>

                    <motion.div variants={fadeUp}>
                      <p className="text-xs font-semibold text-[#9090a8] uppercase tracking-widest mb-3">
                        Room type
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {roomTypeOptions.map((opt) => {
                          const Icon = opt.icon
                          const selected = roomType === opt.id
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setRoomType(opt.id)}
                              className="relative text-left p-4 rounded-2xl border transition-all duration-200 outline-none"
                              style={{
                                background: selected
                                  ? 'rgba(201,168,76,0.08)'
                                  : 'rgba(255,255,255,0.03)',
                                borderColor: selected
                                  ? 'rgba(201,168,76,0.35)'
                                  : 'rgba(255,255,255,0.07)',
                                boxShadow: selected
                                  ? '0 0 24px rgba(201,168,76,0.1)'
                                  : 'none',
                              }}
                            >
                              {opt.recommended && (
                                <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest text-[#c9a84c] bg-[rgba(201,168,76,0.12)] px-1.5 py-0.5 rounded-md">
                                  Rec.
                                </span>
                              )}
                              <Icon
                                className="w-5 h-5 mb-2"
                                style={{ color: selected ? '#c9a84c' : '#5a5a72' }}
                              />
                              <p className="text-sm font-semibold text-[#f0f0f4] mb-0.5">{opt.label}</p>
                              <p className="text-xs text-[#5a5a72] leading-snug">{opt.description}</p>
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>

                    <AnimatePresence>
                      {roomType === 'private' && (
                        <motion.div
                          variants={fadeUp}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <Input
                            label="Room password (optional)"
                            placeholder="Leave blank to skip"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            size="lg"
                            icon={<Lock className="w-4 h-4" />}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div variants={fadeUp}>
                      <p className="text-xs font-semibold text-[#9090a8] uppercase tracking-widest mb-3">
                        Max people
                      </p>
                      <div className="flex gap-2">
                        {[2, 4, 6, 10, 20, 50].map((n) => (
                          <button
                            key={n}
                            onClick={() => setMaxPeople(n)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                            style={{
                              background: maxPeople === n
                                ? 'rgba(201,168,76,0.15)'
                                : 'rgba(255,255,255,0.04)',
                              color: maxPeople === n ? '#c9a84c' : '#5a5a72',
                              border: `1px solid ${maxPeople === n ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.06)'}`,
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div variants={fadeUp}>
                      <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        icon={ChevronRight}
                        iconPosition="right"
                        onClick={handleStep1}
                        glow
                      >
                        Continue
                      </Button>
                    </motion.div>
                  </motion.div>
                </GlassCard>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <GlassCard padding="xl" rounded="2xl">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 text-sm text-[#5a5a72] hover:text-[#9090a8] transition-colors mb-8"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>

                  <div className="mb-8">
                    <h1 className="clamp-title font-display font-bold text-[#f0f0f4] mb-2">
                      What's your name?
                    </h1>
                    <p className="text-sm text-[#7070a0]">
                      Your friends will see this when you join the room.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <Input
                      label="Display name"
                      placeholder="Alex ✨"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      size="lg"
                      autoFocus
                      icon={<Users className="w-4 h-4" />}
                      onKeyDown={(e) => e.key === 'Enter' && displayName.trim() && handleCreate()}
                    />

                    {/* Room summary */}
                    <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                      <p className="text-xs text-[#5a5a72] mb-3 font-semibold uppercase tracking-widest">
                        Room summary
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-[#7070a0]">Name</span>
                          <span className="text-sm text-[#f0f0f4] font-medium">{roomName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-[#7070a0]">Type</span>
                          <span className="text-sm text-[#f0f0f4] font-medium capitalize">{roomType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-[#7070a0]">Capacity</span>
                          <span className="text-sm text-[#f0f0f4] font-medium">Up to {maxPeople} people</span>
                        </div>
                      </div>
                    </div>

                    {createError && (
                      <p className="text-xs text-red-400 text-center -mt-2">{createError}</p>
                    )}

                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      icon={Zap}
                      loading={loading}
                      disabled={!displayName.trim()}
                      onClick={handleCreate}
                      glow
                    >
                      {loading ? 'Creating room…' : 'Create room & enter lobby'}
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  )
}
