'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { TradeWithRelations } from '@/types'

interface CloseTradeFormProps {
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

export function CloseTradeForm({ trade }: CloseTradeFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Synchronous single-flight latch — see TradeForm for the rationale. Stays
  // latched on success (we navigate away); only an error clears it for retry.
  const submittingRef = useRef(false)

  const [exitPrice, setExitPrice] = useState('')
  const [notes, setNotes] = useState(trade.notes ?? '')
  // Manual PnL override at close — hand-enter the platform fill in actual USD.
  // Blank = use the calculated/instrument-factor path.
  const [pnlOverride, setPnlOverride] = useState('')
  const [hasRuleBreak, setHasRuleBreak] = useState(false)
  const [breakType, setBreakType] = useState('EARLY_EXIT')
  const [ruleDescription, setRuleDescription] = useState('')
  const [actualExitPrice, setActualExitPrice] = useState('')
  const [ruleExitPrice, setRuleExitPrice] = useState('')
  const [rbNotes, setRbNotes] = useState('')

  const canSubmit = exitPrice.trim()

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSubmit) return
      // Synchronous single-flight guard — blocks a second submit during the
      // navigation-pending window, independent of React's async state.
      if (submittingRef.current) return
      submittingRef.current = true
      setLoading(true)
      setError(null)

      const body: Record<string, unknown> = {
        exitPrice,
        notes: notes || null,
        // number ⇒ override mode; blank ⇒ null ⇒ instrument-factor path.
        pnlOverride: pnlOverride.trim() ? Number(pnlOverride) : null,
      }

      if (hasRuleBreak && ruleDescription.trim()) {
        body.ruleBreak = {
          breakType,
          ruleDescription,
          actualExitPrice: actualExitPrice || exitPrice,
          ruleExitPrice: ruleExitPrice || null,
          notes: rbNotes || null,
        }
      }

      try {
        const res = await fetch(`/api/trades/${trade.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(JSON.stringify(data.error ?? 'Failed to close trade'))
        }

        // Success: stay latched/disabled until router.push unmounts the form.
        router.push(`/trades/${trade.id}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        submittingRef.current = false
        setLoading(false)
      }
    },
    [
      canSubmit, exitPrice, notes, pnlOverride, hasRuleBreak, breakType, ruleDescription,
      actualExitPrice, ruleExitPrice, rbNotes, trade.id, router,
    ]
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Exit Price"
        placeholder="0.00"
        inputMode="decimal"
        value={exitPrice}
        onChange={(e) => setExitPrice(e.target.value)}
        className="font-mono"
      />

      {/* Manual PnL override at close — the platform fill in actual USD. */}
      <div className="flex flex-col gap-1">
        <Input
          label="Override PnL (actual USD, optional)"
          placeholder="leave blank to use calculated"
          inputMode="decimal"
          value={pnlOverride}
          onChange={(e) => setPnlOverride(e.target.value)}
          className="font-mono"
        />
        <span className="text-[11px] text-[var(--color-ink-muted)]">
          Enter the real USD PnL from your platform — an implied factor scales executionPnl/rule-break impact. rMultiple unaffected.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-ink-secondary)]">
          Post-Trade Notes
        </label>
        <textarea
          rows={3}
          placeholder="How did the trade play out? What did you learn?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={5000}
          className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none transition-colors"
        />
      </div>

      {/* Rule break section */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="hasRuleBreak"
          checked={hasRuleBreak}
          onChange={(e) => setHasRuleBreak(e.target.checked)}
          className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
        />
        <label
          htmlFor="hasRuleBreak"
          className="text-sm text-[var(--color-ink-secondary)] cursor-pointer"
        >
          This was a non-rule exit
        </label>
      </div>

      {hasRuleBreak && (
        <div
          className="flex flex-col gap-4 p-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-loss-bg)]"
          style={{ borderWidth: '0.5px' }}
        >
          <p className="text-xs font-semibold text-[var(--color-loss)] uppercase tracking-wider">
            Rule Break Details
          </p>

          <Select
            label="Break Type"
            options={RULE_BREAK_OPTIONS}
            value={breakType}
            onChange={(e) => setBreakType(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-ink-secondary)]">
              Rule That Was Broken
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Must exit full position at T1"
              value={ruleDescription}
              onChange={(e) => setRuleDescription(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-loss)] resize-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Actual Exit Price"
              placeholder={exitPrice || '0.00'}
              inputMode="decimal"
              value={actualExitPrice}
              onChange={(e) => setActualExitPrice(e.target.value)}
              className="font-mono"
            />
            <Input
              label="Rule Exit Price"
              placeholder="Where should you have exited?"
              inputMode="decimal"
              value={ruleExitPrice}
              onChange={(e) => setRuleExitPrice(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-ink-secondary)]">
              Reflection
            </label>
            <textarea
              rows={2}
              placeholder="Honest reflection on why you broke the rule"
              value={rbNotes}
              onChange={(e) => setRbNotes(e.target.value)}
              maxLength={2000}
              className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-loss)] resize-none transition-colors"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-[var(--color-loss)] bg-[var(--color-loss-bg)] px-3 py-2 rounded-[var(--radius-md)]">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!canSubmit || loading}>
        {loading ? 'Closing…' : 'Close Trade'}
      </Button>
    </form>
  )
}
