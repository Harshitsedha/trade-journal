import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-[var(--color-ink-secondary)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors ${error ? 'border-[var(--color-loss)]' : ''} ${className}`}
        {...props}
      />
      {error && (
        <span className="text-xs text-[var(--color-loss)]">{error}</span>
      )}
    </div>
  )
}
