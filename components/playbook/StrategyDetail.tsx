'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TriggerRuleList } from './TriggerRuleList'
import { PDFUploader } from './PDFUploader'
import type { TriggerRule, SubSetup } from '@/generated/prisma/client'

interface SetupStats {
  total: number
  winRate: number
  avgR: number
}

interface SetupWithFull {
  id: string
  name: string
  description: string | null
  pdfUrl: string | null
  pdfCloudinaryId: string | null
  triggerRules: TriggerRule[]
  subSetups: (SubSetup & { _count: { trades: number } })[]
  _count: { trades: number }
  stats: SetupStats
}

interface StrategyDetailProps {
  setup: SetupWithFull
}

export function StrategyDetail({ setup }: StrategyDetailProps) {
  const [notes, setNotes] = useState(setup.description ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function saveNotes() {
    setSaving(true)
    try {
      await fetch(`/api/setups/${setup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: notes }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-ink)] mb-1">{setup.name}</h2>
        <div className="flex gap-4 text-xs text-[var(--color-ink-muted)]">
          <span>{setup._count.trades} trades</span>
          {setup.stats.total > 0 && (
            <>
              <span>{(setup.stats.winRate * 100).toFixed(0)}% win</span>
              <span>{setup.stats.avgR > 0 ? '+' : ''}{setup.stats.avgR.toFixed(2)}R avg</span>
            </>
          )}
        </div>
      </div>

      {/* PDF */}
      <section>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)] mb-2">
          Playbook PDF
        </p>
        <PDFUploader
          setupId={setup.id}
          initialPdfUrl={setup.pdfUrl}
          initialPdfCloudinaryId={setup.pdfCloudinaryId}
        />
      </section>

      {/* Trigger Rules */}
      <section>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)] mb-2">
          Trigger Rules
        </p>
        <TriggerRuleList setupId={setup.id} initialRules={setup.triggerRules} />
      </section>

      {/* Sub-Setups */}
      {setup.subSetups.length > 0 && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)] mb-2">
            Sub-Setups
          </p>
          <div className="flex flex-col gap-1">
            {setup.subSetups.map(sub => (
              <div
                key={sub.id}
                className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)]"
              >
                <span className="text-sm text-[var(--color-ink)]">{sub.name}</span>
                <span className="text-xs text-[var(--color-ink-muted)]">{sub._count.trades} trades</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes / Entry-Exit */}
      <section>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)] mb-2">
          Entry / Exit Notes
        </p>
        <textarea
          rows={5}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Document entry conditions, exit rules, trade management…"
          className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none transition-colors"
          style={{ borderWidth: '0.5px' }}
        />
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" onClick={saveNotes} disabled={saving}>
            {saving ? 'Saving…' : 'Save Notes'}
          </Button>
          {saved && <span className="text-xs text-[var(--color-profit)]">Saved</span>}
        </div>
      </section>
    </div>
  )
}
