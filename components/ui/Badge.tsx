import type { ReactNode } from 'react'

type BadgeVariant = 'profit' | 'loss' | 'open' | 'accent' | 'muted'

interface BadgeProps {
  variant: BadgeVariant
  children: ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  profit: 'bg-[var(--color-profit-bg)] text-[var(--color-profit)]',
  loss: 'bg-[var(--color-loss-bg)] text-[var(--color-loss)]',
  open: 'bg-[var(--color-open-bg)] text-[var(--color-open)]',
  accent: 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]',
  muted:
    'bg-[var(--color-surface-sunken)] text-[var(--color-ink-secondary)]',
}

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
