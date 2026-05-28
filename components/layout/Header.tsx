import type { ReactNode } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ borderWidth: '0.5px' }}
    >
      <div>
        <h1 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h1>
        {subtitle && (
          <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
