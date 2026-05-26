'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, iconRight, size = 'md', className, ...props }, ref) => {
    const sizeStyles = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-12 px-4 text-[0.9375rem]',
      lg: 'h-14 px-5 text-base',
    }

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-xs font-semibold text-[#9090a8] uppercase tracking-widest">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-4 text-[#5a5a72] pointer-events-none z-10">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            className={cn(
              'w-full',
              'bg-white/[0.05] backdrop-blur-sm',
              'border border-white/[0.1]',
              'text-[#f0f0f4] placeholder:text-[#4a4a60]',
              'rounded-xl',
              'outline-none',
              'transition-all duration-200',
              'focus:border-[rgba(201,168,76,0.5)] focus:bg-white/[0.07]',
              'focus:shadow-[0_0_0_3px_rgba(201,168,76,0.12)]',
              error && 'border-red-500/50 focus:border-red-500/80 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]',
              icon     && 'pl-11',
              iconRight && 'pr-11',
              sizeStyles[size],
              className
            )}
            {...props}
          />

          {iconRight && (
            <span className="absolute right-4 text-[#5a5a72] pointer-events-none z-10">
              {iconRight}
            </span>
          )}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-400 font-medium"
          >
            {error}
          </motion.p>
        )}

        {hint && !error && (
          <p className="text-xs text-[#5a5a72]">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
