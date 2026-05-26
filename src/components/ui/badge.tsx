import { cn } from '@/lib/utils'

type BadgeVariant = 'gold' | 'blue' | 'green' | 'red' | 'ghost' | 'outline'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  dot?: boolean
  size?: 'sm' | 'md'
  className?: string
  title?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  gold:    'bg-[rgba(201,168,76,0.15)] text-[#e6c46a] border border-[rgba(201,168,76,0.2)]',
  blue:    'bg-[rgba(59,130,246,0.15)] text-[#60a5fa] border border-[rgba(59,130,246,0.2)]',
  green:   'bg-[rgba(34,197,94,0.15)] text-[#4ade80] border border-[rgba(34,197,94,0.2)]',
  red:     'bg-[rgba(239,68,68,0.15)] text-[#f87171] border border-[rgba(239,68,68,0.2)]',
  ghost:   'bg-white/[0.06] text-[#9090a8] border border-white/[0.08]',
  outline: 'bg-transparent text-[#9090a8] border border-white/[0.12]',
}

const dotColors: Record<BadgeVariant, string> = {
  gold:    'bg-[#c9a84c]',
  blue:    'bg-[#3b82f6]',
  green:   'bg-[#22c55e]',
  red:     'bg-[#ef4444]',
  ghost:   'bg-[#9090a8]',
  outline: 'bg-[#9090a8]',
}

export function Badge({
  children,
  variant = 'ghost',
  dot = false,
  size = 'sm',
  className,
  title,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'rounded-full shrink-0 animate-pulse',
            size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  )
}
