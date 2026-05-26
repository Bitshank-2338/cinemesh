'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link2, Users, PlayCircle, ArrowRight } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: PlayCircle,
    title: 'Create your room',
    description: 'Hit the button, name your room, set a password if you want. Your private cinema is ready in seconds.',
    color: '#c9a84c',
    gradient: 'from-[#c9a84c]/20 to-[#a87a30]/10',
  },
  {
    number: '02',
    icon: Link2,
    title: 'Share the link',
    description: 'Copy your unique room link and send it to whoever you\'re watching with. One click to join.',
    color: '#3b82f6',
    gradient: 'from-[#3b82f6]/20 to-[#1d4ed8]/10',
  },
  {
    number: '03',
    icon: Users,
    title: 'Watch together',
    description: 'Everyone opens the content on their own player. Hit play and CineMesh keeps everyone perfectly in sync.',
    color: '#a78bfa',
    gradient: 'from-[#a78bfa]/20 to-[#7c3aed]/10',
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative py-32 px-6"
    >
      {/* Background accent */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#3b82f6] mb-4 block">
            Simple by design
          </span>
          <h2 className="clamp-display font-display font-bold text-[#f0f0f4] mb-4">
            Up and watching{' '}
            <span className="text-gradient-gold">in 30 seconds</span>
          </h2>
          <p className="text-[#7070a0] text-base max-w-xl mx-auto leading-relaxed">
            No downloads. No accounts required. No friction between you and your movie night.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line */}
          <div
            className="absolute top-16 left-[calc(16.67%+32px)] right-[calc(16.67%+32px)] h-px hidden lg:block"
            style={{
              background: 'linear-gradient(90deg, rgba(201,168,76,0.3), rgba(59,130,246,0.3), rgba(167,139,250,0.3))',
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.number}
                  className="flex flex-col items-center lg:items-start text-center lg:text-left"
                  initial={{ opacity: 0, y: 40 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: i * 0.15, ease: [0.4, 0, 0.2, 1] }}
                >
                  {/* Step icon */}
                  <div className="relative mb-8">
                    <div
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center`}
                      style={{
                        border: `1px solid ${step.color}28`,
                        boxShadow: `0 0 40px ${step.color}15`,
                      }}
                    >
                      <Icon className="w-7 h-7" style={{ color: step.color }} />
                    </div>

                    {/* Step number */}
                    <div
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: step.color,
                        color: '#06060e',
                        boxShadow: `0 0 16px ${step.color}60`,
                      }}
                    >
                      {i + 1}
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="font-display font-bold text-xl text-[#f0f0f4] mb-3">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#7070a0] leading-relaxed max-w-xs">
                    {step.description}
                  </p>

                  {/* Connector arrow on mobile */}
                  {i < steps.length - 1 && (
                    <div className="flex justify-center mt-6 lg:hidden">
                      <ArrowRight
                        className="w-5 h-5 rotate-90 text-[#3a3a50]"
                      />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
