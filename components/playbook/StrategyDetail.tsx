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
  onDeleted?: () => void
}

export function StrategyDetail({ setup, onDeleted }: StrategyDetailProps) {
  const [notes, setNotes] = useState(setup.description ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/setups/${setup.id}`, { method: 'DELETE' })
      if (res.status === 409) {
        const data = await res.json()
        const count: number = data.tradesCount ?? 0
        setDeleteError(
          `Can't delete — ${count} trade${count !== 1 ? 's' : ''} use this setup. Reassign or delete those trades first.`
        )
        setConfirmDelete(false)
        return
      }
      if (!res.ok) throw new Error('Failed to delete')
      onDeleted?.()
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to delete') throw err
      setDeleteError('Failed to delete setup. Please try again.')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">
      <div className="flex items-start justify-between">
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

        {/* Delete control */}
        {!confirmDelete ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
          >
            Delete Setup
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-[var(--color-loss)]">
              Delete this setup? This cannot be undone.
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {deleteError && (
        <p className="text-xs text-[var(--color-loss)] bg-[var(--color-loss-bg)] px-3 py-2 rounded-[var(--radius-md)]">
          {deleteError}
        </p>
      )}

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
