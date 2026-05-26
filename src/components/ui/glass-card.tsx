'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'
import { cardHover } from '@/lib/motion'

interface GlassCardProps extends HTMLMotionProps<'div'> {
  hover?: boolean
  glow?: 'gold' | 'blue' | 'none'
  padding?: 'sm' | 'md' | 'lg' | 'xl' | 'none'
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  border?: boolean
}

const paddingMap = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
  xl:   'p-10',
}

const roundedMap = {
  md:   'rounded-xl',
  lg:   'rounded-2xl',
  xl:   'rounded-3xl',
  '2xl':'rounded-[1.5rem]',
  '3xl':'rounded-[2rem]',
}

const glowMap = {
  none: '',
  gold: 'hover:shadow-[0_0_60px_rgba(201,168,76,0.18),inset_0_0_0_1px_rgba(201,168,76,0.12)]',
  blue: 'hover:shadow-[0_0_60px_rgba(59,130,246,0.18),inset_0_0_0_1px_rgba(59,130,246,0.12)]',
}

export function GlassCard({
  hover = false,
  glow = 'none',
  padding = 'md',
  rounded = 'xl',
  border = true,
  className,
  children,
  ...props
}: GlassCardProps) {
  const baseClass = cn(
    'relative overflow-hidden',
    'bg-white/[0.04] backdrop-blur-xl',
    border && 'border border-white/[0.07]',
    paddingMap[padding],
    roundedMap[rounded],
    glowMap[glow],
    'transition-shadow duration-300',
    className
  )

  if (hover) {
    return (
      <motion.div
        className={baseClass}
        initial="rest"
        whileHover="hover"
        variants={cardHover}
        {...props}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div className={baseClass} {...props}>
      {children}
    </motion.div>
  )
}

// ─── Glass Panel (sidebar / overlay panel) ───────────────────────
interface GlassPanelProps {
  children: React.ReactNode
  className?: string
  side?: 'left' | 'right' | 'bottom'
}

export function GlassPanel({ children, className, side = 'right' }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        'bg-[rgba(8,8,20,0.8)] backdrop-blur-2xl',
        'border-white/[0.08]',
        side === 'right'  && 'border-l',
        side === 'left'   && 'border-r',
        side === 'bottom' && 'border-t',
        className
      )}
    >
      {children}
    </div>
  )
}
