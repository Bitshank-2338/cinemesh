'use client'

import { type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle' | 'icon'
type ButtonSize    = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  loading?: boolean
  fullWidth?: boolean
  glow?: boolean
  children?: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-gradient-to-br from-[#d4a843] via-[#c9a84c] to-[#b89040]',
    'text-[#0a0808] font-semibold',
    'border border-[rgba(255,220,100,0.2)]',
    'hover:shadow-[0_8px_30px_rgba(201,168,76,0.4),0_2px_8px_rgba(201,168,76,0.2)]',
  ].join(' '),
  ghost: [
    'bg-transparent',
    'text-[#f0f0f4]',
    'border border-white/[0.1]',
    'hover:bg-white/[0.06] hover:border-white/[0.18]',
  ].join(' '),
  danger: [
    'bg-gradient-to-br from-red-600 to-red-700',
    'text-white font-semibold',
    'hover:shadow-[0_8px_30px_rgba(239,68,68,0.35)]',
  ].join(' '),
  subtle: [
    'bg-white/[0.06]',
    'text-[#f0f0f4]',
    'border border-white/[0.06]',
    'hover:bg-white/[0.1] hover:border-white/[0.12]',
  ].join(' '),
  icon: [
    'bg-white/[0.06]',
    'text-[#f0f0f4]',
    'border border-white/[0.06]',
    'hover:bg-white/[0.1]',
    'rounded-full aspect-square',
  ].join(' '),
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-sm rounded-xl gap-1.5',
  md: 'px-5 py-2.5 text-[0.9375rem] rounded-xl gap-2',
  lg: 'px-7 py-3.5 text-base rounded-2xl gap-2.5',
  xl: 'px-8 py-4 text-lg rounded-2xl gap-3',
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-14 h-14',
}

export function Button({
  variant = 'ghost',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  glow = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isIcon = variant === 'icon'

  return (
    <motion.button
      whileHover={{ scale: 1.015, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center justify-center',
        'font-display font-semibold tracking-tight',
        'cursor-pointer select-none',
        'transition-colors transition-shadow duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a84c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060e]',
        variantStyles[variant],
        isIcon ? iconSizeStyles[size] : sizeStyles[size],
        fullWidth && 'w-full',
        glow && variant === 'primary' && 'shadow-[0_0_40px_rgba(201,168,76,0.25)]',
        className
      )}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size={size} />
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon className={cn('shrink-0', getIconSize(size))} />
          )}
          {children && <span className={isIcon ? 'sr-only' : ''}>{children}</span>}
          {Icon && iconPosition === 'right' && (
            <Icon className={cn('shrink-0', getIconSize(size))} />
          )}
        </>
      )}

      {/* Shimmer overlay for primary */}
      {variant === 'primary' && (
        <span
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 60%)',
          }}
        />
      )}
    </motion.button>
  )
}

function getIconSize(size: ButtonSize) {
  const map = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5', xl: 'w-6 h-6' }
  return map[size]
}

function LoadingSpinner({ size }: { size: ButtonSize }) {
  const s = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5', xl: 'w-6 h-6' }[size]
  return (
    <svg className={cn('animate-spin', s)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
