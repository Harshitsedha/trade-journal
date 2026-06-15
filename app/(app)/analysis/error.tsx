'use client'

import { useEffect } from 'react'

// Error boundary for the Analysis route. If anything in the page or its client
// components throws during render (e.g. an unexpected null in filter/group data),
// this renders a recoverable message instead of a white-screen crash.
export default function AnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Analysis page error:', error)
  }, [error])

  return (
    <div
      style={{
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        maxWidth: 600,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)' }}>
        Something went wrong loading Analysis
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>
        The view hit an unexpected error. Your data is safe — try again, or adjust
        the filters.
      </p>
      <div>
        <button
          onClick={reset}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '0.5px solid var(--color-border-strong)',
            background: 'var(--color-accent-bg)',
            color: 'var(--color-accent)',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
