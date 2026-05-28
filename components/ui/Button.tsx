import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  children: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-ink)] text-[var(--color-surface)] hover:opacity-80',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]',
  ghost:
    'bg-transparent text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]',
  danger:
    'bg-[var(--color-loss-bg)] text-[var(--color-loss)] border border-[var(--color-loss)] hover:opacity-80',
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
