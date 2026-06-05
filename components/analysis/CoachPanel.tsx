'use client'
import { useState } from 'react'
import type { AnalysisResult, FilterState } from './types'

interface Props {
  result: AnalysisResult
  filters: FilterState
}

export function CoachPanel({ result, filters }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analysis/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...result, activeFilters: filters }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSummary(data.summary)
      }
    } catch {
      setError('Network error — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: summary ? 'var(--space-3)' : 0,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-ink-muted)',
          }}
        >
          AI Coaching Summary
        </p>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '0.5px solid var(--color-border-strong)',
            background: loading ? 'var(--color-surface-sunken)' : 'var(--color-accent-bg)',
            color: loading ? 'var(--color-ink-muted)' : 'var(--color-accent)',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {loading ? 'Generating…' : summary ? 'Regenerate' : 'Generate coaching summary'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: 'var(--color-loss)', marginTop: 'var(--space-2)' }}>
          {error}
        </p>
      )}

      {summary && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--color-surface-sunken)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--color-ink)',
            whiteSpace: 'pre-wrap',
          }}
        >
          <MarkdownProse text={summary} />
        </div>
      )}
    </div>
  )
}

function MarkdownProse({ text }: { text: string }) {
  // Light markdown: bold, bullets, numbers
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('## '))
          return <p key={i} style={{ fontWeight: 700, marginTop: 8, marginBottom: 2 }}>{line.slice(3)}</p>
        if (line.startsWith('# '))
          return <p key={i} style={{ fontWeight: 700, marginTop: 8, marginBottom: 2 }}>{line.slice(2)}</p>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <p key={i} style={{ marginLeft: 12 }}>• {renderBold(line.slice(2))}</p>
        if (/^\d+\. /.test(line))
          return <p key={i} style={{ marginLeft: 12 }}>{renderBold(line)}</p>
        if (line.trim() === '') return <br key={i} />
        return <p key={i}>{renderBold(line)}</p>
      })}
    </>
  )
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}
