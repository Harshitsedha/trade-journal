'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import type { TradeWithRelations } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ImageUploader } from './ImageUploader'
import { EditTradeForm } from './EditTradeForm'

interface TradeDetailProps {
  trade: TradeWithRelations
}

const RULE_BREAK_OPTIONS = [
  { value: 'EARLY_EXIT', label: 'Early Exit' },
  { value: 'LATE_EXIT', label: 'Late Exit' },
  { value: 'MOVED_STOP', label: 'Moved Stop' },
  { value: 'OVERSIZED', label: 'Oversized' },
  { value: 'REVENGE_TRADE', label: 'Revenge Trade' },
  { value: 'OTHER', label: 'Other' },
]

export function TradeDetail({ trade }: TradeDetailProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Quick exit state
  const [qeExitPrice, setQeExitPrice] = useState('')
  const [qeIdealExit, setQeIdealExit] = useState('')
  const [qeEntryRuleCorrect, setQeEntryRuleCorrect] = useState<boolean | null>(null)
  const [qeHasRuleBreak, setQeHasRuleBreak] = useState(false)
  const [qeBreakType, setQeBreakType] = useState('EARLY_EXIT')
  const [qeRuleDescription, setQeRuleDescription] = useState('')
  const [qeActualExitPrice, setQeActualExitPrice] = useState('')
  const [qeRuleExitPrice, setQeRuleExitPrice] = useState('')
  const [qeRbNotes, setQeRbNotes] = useState('')
  const [qeLoading, setQeLoading] = useState(false)
  const [qeError, setQeError] = useState<string | null>(null)

  const r = trade.rMultiple ? new Decimal(trade.rMultiple.toString()) : null
  const pnl = trade.pnl ? new Decimal(trade.pnl.toString()) : null
  const isOpen = trade.status === 'OPEN'

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/trades/${trade.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      router.push('/dashboard')
      router.refresh()
    } catch {
      setDeleteError('Failed to delete trade. Please try again.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleQuickExit() {
    if (!qeExitPrice.trim()) return
    setQeLoading(true)
    setQeError(null)

    const body: Record<string, unknown> = {
      instrument: trade.instrument,
      assetClass: trade.assetClass,
      expiry: trade.expiry ? new Date(trade.expiry).toISOString() : null,
      setupId: trade.setupId,
      subSetupId: trade.subSetupId ?? null,
      direction: trade.direction,
      entryPrice: trade.entryPrice.toString(),
      stopLoss: trade.stopLoss.toString(),
      targets: (trade.targets as Decimal[]).map(t => t.toString()),
      quantity: trade.quantity.toString(),
      riskAmount: trade.riskAmount.toString(),
      thesis: trade.thesis ?? null,
      notes: trade.notes ?? null,
      tradeDate: new Date(trade.tradeDate).toISOString(),
      triggerRules: trade.triggerRules.map(tr => ({
        triggerRuleId: tr.triggerRuleId,
        isPrimary: tr.isPrimary,
      })),
      exitPrice: qeExitPrice,
      idealExit: qeIdealExit.trim() || null,
      entryRuleCorrect: qeEntryRuleCorrect,
      status: 'CLOSED',
    }

    if (qeHasRuleBreak && qeRuleDescription.trim()) {
      body.ruleBreak = {
        breakType: qeBreakType,
        ruleDescription: qeRuleDescription,
        actualExitPrice: qeActualExitPrice || qeExitPrice,
        ruleExitPrice: qeRuleExitPrice || null,
        notes: qeRbNotes || null,
      }
    }

    try {
      const res = await fetch(`/api/trades/${trade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to close trade')
      router.refresh()
    } catch (err) {
      setQeError(err instanceof Error ? err.message : 'Failed to close trade')
    } finally {
      setQeLoading(false)
    }
  }

  const entryRuleCorrect: boolean | null = (trade as Record<string, unknown>).entryRuleCorrect as boolean | null ?? null

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold font-mono text-[var(--color-ink)]">
              {trade.instrument}
            </h2>
            <Badge variant={trade.direction === 'LONG' ? 'accent' : 'loss'}>
              {trade.direction}
            </Badge>
            <Badge
              variant={
                trade.status === 'CLOSED'
                  ? 'profit'
                  : trade.status === 'MISSED' || trade.status === 'SKIP'
                  ? 'muted'
                  : 'open'
              }
            >
              {trade.status}
            </Badge>
            {entryRuleCorrect === true && (
              <Badge variant="profit">Rules ✓</Badge>
            )}
            {entryRuleCorrect === false && (
              <Badge variant="loss">Rules ✗</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
            {trade.setup.name}
            {trade.subSetup && ` · ${trade.subSetup.name}`}
            {' · '}
            {new Date(trade.tradeDate).toLocaleDateString('en-IN', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: '2-digit',
            })}
          </p>
        </div>

        <div className="flex items-start gap-4">
          {/* R & P&L */}
          <div className="text-right">
            {r !== null && (
              <p
                className={`text-2xl font-semibold font-mono ${
                  r.gt(0) ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'
                }`}
              >
                {r.gt(0) ? '+' : ''}
                {r.toFixed(2)}R
              </p>
            )}
            {pnl !== null && (
              <p
                className={`text-sm font-mono ${
                  pnl.gt(0) ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'
                }`}
              >
                {pnl.gt(0) ? '+' : ''}₹{pnl.toFixed(0)}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setIsEditing(v => !v); setConfirmDelete(false) }}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
            {!confirmDelete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setConfirmDelete(true); setIsEditing(false) }}
              >
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-loss)]">Delete this trade? This cannot be undone.</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Confirm'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteError && (
        <p className="text-xs text-[var(--color-loss)] bg-[var(--color-loss-bg)] px-3 py-2 rounded-[var(--radius-md)]">
          {deleteError}
        </p>
      )}

      {/* Quick Exit — visible for OPEN trades when not in full edit mode */}
      {isOpen && !isEditing && (
        <div
          className="flex flex-col gap-4 p-5 rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-surface)]"
          style={{ borderWidth: '0.5px' }}
        >
          <p className="text-sm font-semibold text-[var(--color-ink)]">Close Trade</p>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Exit Price"
              placeholder="0.00"
              inputMode="decimal"
              value={qeExitPrice}
              onChange={e => setQeExitPrice(e.target.value)}
              className="font-mono"
            />
            <Input
              label="Ideal Exit (optional)"
              placeholder="0.00"
              inputMode="decimal"
              value={qeIdealExit}
              onChange={e => setQeIdealExit(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-ink-secondary)]">Entry rules followed?</span>
            <div className="flex gap-2">
              {([null, true, false] as const).map(v => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setQeEntryRuleCorrect(v)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] border transition-all cursor-pointer ${
                    qeEntryRuleCorrect === v
                      ? v === true
                        ? 'bg-[var(--color-profit-bg)] text-[var(--color-profit)] border-[var(--color-profit)]'
                        : v === false
                        ? 'bg-[var(--color-loss-bg)] text-[var(--color-loss)] border-[var(--color-loss)]'
                        : 'bg-[var(--color-ink)] text-[var(--color-surface)] border-[var(--color-ink)]'
                      : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] border-[var(--color-border)]'
                  }`}
                >
                  {v === null ? '—' : v ? 'Yes ✓' : 'No ✗'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="qeHasRuleBreak"
              checked={qeHasRuleBreak}
              onChange={e => setQeHasRuleBreak(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
            />
            <label htmlFor="qeHasRuleBreak" className="text-sm text-[var(--color-ink-secondary)] cursor-pointer">
              Non-rule exit
            </label>
          </div>

          {qeHasRuleBreak && (
            <div
              className="flex flex-col gap-3 p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-loss-bg)]"
              style={{ borderWidth: '0.5px' }}
            >
              <p className="text-xs font-semibold text-[var(--color-loss)] uppercase tracking-wider">Rule Break</p>
              <Select
                label="Break Type"
                options={RULE_BREAK_OPTIONS}
                value={qeBreakType}
                onChange={e => setQeBreakType(e.target.value)}
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-ink-secondary)]">Rule That Was Broken</label>
                <textarea
                  rows={2}
                  placeholder="Which rule did you break?"
                  value={qeRuleDescription}
                  onChange={e => setQeRuleDescription(e.target.value)}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-loss)] resize-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Actual Exit"
                  placeholder={qeExitPrice || '0.00'}
                  inputMode="decimal"
                  value={qeActualExitPrice}
                  onChange={e => setQeActualExitPrice(e.target.value)}
                  className="font-mono"
                />
                <Input
                  label="Rule Exit"
                  placeholder="Where should you have exited?"
                  inputMode="decimal"
                  value={qeRuleExitPrice}
                  onChange={e => setQeRuleExitPrice(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-ink-secondary)]">Reflection</label>
                <textarea
                  rows={2}
                  placeholder="Why did you break the rule?"
                  value={qeRbNotes}
                  onChange={e => setQeRbNotes(e.target.value)}
                  maxLength={2000}
                  className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-loss)] resize-none transition-colors"
                />
              </div>
            </div>
          )}

          {qeError && (
            <p className="text-xs text-[var(--color-loss)] bg-[var(--color-loss-bg)] px-3 py-2 rounded-[var(--radius-md)]">
              {qeError}
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={handleQuickExit} disabled={!qeExitPrice.trim() || qeLoading}>
              {qeLoading ? 'Closing…' : 'Close Trade'}
            </Button>
          </div>
        </div>
      )}

      {/* Pricing grid */}
      <div className="grid grid-cols-4 gap-px bg-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
        {[
          { label: 'Entry', value: trade.entryPrice.toString() },
          { label: 'Stop', value: trade.stopLoss.toString() },
          { label: 'Exit', value: trade.exitPrice?.toString() ?? '—' },
          { label: 'Qty', value: trade.quantity.toString() },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-1 px-4 py-3 bg-[var(--color-surface)]"
          >
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-muted)]">
              {label}
            </span>
            <span className="font-mono text-sm font-semibold text-[var(--color-ink)]">
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Execution quality — shown when an ideal exit is recorded */}
      {(trade as Record<string, unknown>).idealExit != null && (() => {
        const idealExitVal = String((trade as Record<string, unknown>).idealExit)
        const execRaw = (trade as Record<string, unknown>).executionPnl
        const execNum = execRaw != null ? Number(String(execRaw)) : null
        const execColor =
          execNum != null && execNum < 0
            ? 'text-[var(--color-loss)]'
            : execNum != null && execNum > 0
            ? 'text-[var(--color-profit)]'
            : 'text-[var(--color-ink)]'
        return (
          <div className="grid grid-cols-2 gap-px bg-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
            <div className="flex flex-col gap-1 px-4 py-3 bg-[var(--color-surface)]">
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                Ideal Exit
              </span>
              <span className="font-mono text-sm font-semibold text-[var(--color-ink)]">
                {idealExitVal}
              </span>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3 bg-[var(--color-surface)]">
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                Execution P&amp;L
              </span>
              <span className={`font-mono text-sm font-semibold ${execColor}`}>
                {execNum != null ? `${execNum > 0 ? '+' : ''}₹${execNum.toFixed(0)}` : '—'}
              </span>
            </div>
          </div>
        )
      })()}

      {/* Targets */}
      {trade.targets.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            Targets
          </p>
          <div className="flex gap-2 flex-wrap">
            {trade.targets.map((t: Decimal, i: number) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] font-mono text-sm text-[var(--color-ink)]"
              >
                T{i + 1}: {t.toString()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trigger rules (read-only) */}
      {!isEditing && trade.triggerRules.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            Trigger Rules
          </p>
          <div className="flex flex-wrap gap-1.5">
            {trade.triggerRules
              .slice()
              .sort((a, b) => a.triggerRule.precedence - b.triggerRule.precedence)
              .map(t => (
                <span
                  key={t.triggerRuleId}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    t.isPrimary
                      ? 'bg-[var(--color-ink)] text-[var(--color-surface)]'
                      : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-secondary)] border border-[var(--color-border)]'
                  }`}
                  style={{ borderWidth: t.isPrimary ? '0' : '0.5px' }}
                >
                  R{t.triggerRule.precedence} · {t.triggerRule.name}
                  {t.isPrimary && (
                    <span className="ml-1 text-[10px] opacity-70 uppercase tracking-wide">primary</span>
                  )}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Thesis (read-only) */}
      {!isEditing && trade.thesis && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            Entry Thesis
          </p>
          <p className="text-sm text-[var(--color-ink-secondary)] leading-relaxed">
            {trade.thesis}
          </p>
        </div>
      )}

      {/* Notes (read-only) */}
      {!isEditing && trade.notes && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            Notes
          </p>
          <p className="text-sm text-[var(--color-ink-secondary)] leading-relaxed">
            {trade.notes}
          </p>
        </div>
      )}

      {/* Edit form */}
      {isEditing && (
        <div
          className="flex flex-col gap-4 p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          style={{ borderWidth: '0.5px' }}
        >
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {trade.status === 'OPEN' ? 'Edit / Close Trade' : 'Edit Trade'}
          </p>
          <EditTradeForm trade={trade} onDone={() => setIsEditing(false)} />
        </div>
      )}

      {/* Rule break */}
      {trade.ruleBreak && (
        <div
          className="flex flex-col gap-3 p-4 rounded-[var(--radius-lg)] border border-[var(--color-loss)] bg-[var(--color-loss-bg)]"
          style={{ borderWidth: '0.5px' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-loss)]">
            Rule Break · {trade.ruleBreak.breakType.replace(/_/g, ' ')}
          </p>
          <p className="text-sm text-[var(--color-ink-secondary)]">
            {trade.ruleBreak.ruleDescription}
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--color-ink-muted)]">P&L Impact: </span>
              <span className="font-mono text-[var(--color-loss)]">
                ₹{new Decimal(trade.ruleBreak.pnlImpact.toString()).toFixed(0)}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-ink-muted)]">R Impact: </span>
              <span className="font-mono text-[var(--color-loss)]">
                {new Decimal(trade.ruleBreak.rMultipleImpact.toString()).toFixed(2)}R
              </span>
            </div>
          </div>
          {trade.ruleBreak.notes && (
            <p className="text-xs text-[var(--color-ink-secondary)] italic">
              {trade.ruleBreak.notes}
            </p>
          )}
        </div>
      )}

      {/* Chart images */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
          Charts
        </p>
        <ImageUploader tradeId={trade.id} images={trade.images} />
      </div>
    </div>
  )
}
