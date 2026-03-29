import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'muted' | 'purple'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default:  'bg-surface-el border-border-bright text-text-muted',
  accent:   'bg-accent/10 border-accent/25 text-accent',
  success:  'bg-success/10 border-success/25 text-success',
  warning:  'bg-warning/10 border-warning/25 text-warning',
  danger:   'bg-danger/10 border-danger/25 text-danger',
  muted:    'bg-surface border-border text-text-faint',
  purple:   'bg-purple/10 border-purple/25 text-purple',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-px text-[10px]',
  md: 'px-2 py-0.5 text-xs',
}

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded border',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  )
}
