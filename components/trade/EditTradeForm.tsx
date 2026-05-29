'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { TradeWithRelations, TriggerRule, TriggerDirection } from '@/types'

interface EditTradeFormProps {
  trade: TradeWithRelations
  onDone: () => void
}

interface SelectedTrigger {
  triggerRuleId: string
  isPrimary: boolean
}

const RULE_BREAK_OPTIONS = [
  { value: 'EARLY_EXIT', label: 'Early Exit' },
  { value: 'LATE_EXIT', label: 'Late Exit' },
  { value: 'MOVED_STOP', label: 'Moved Stop' },
  { value: 'OVERSIZED', label: 'Oversized' },
  { value: 'REVENGE_TRADE', label: 'Revenge Trade' },
  { value: 'OTHER', label: 'Other' },
]

const directionColors: Record<TriggerDirection, string> = {
  LONG: 'text-[var(--color-profit)]',
  SHORT: 'text-[var(--color-loss)]',
  BOTH: 'text-[var(--color-accent)]',
}

export function EditTradeForm({ trade, onDone }: EditTradeFormProps) {
  const router = useRouter()
  const isOpen = trade.status === 'OPEN'

  // Always-editable fields
  const [thesis, setThesis] = useState(trade.thesis ?? '')
  const [notes, setNotes] = useState(trade.notes ?? '')

  // Trigger rules
  const [availableRules, setAvailableRules] = useState<TriggerRule[]>([])
  const [selectedTriggers, setSelectedTriggers] = useState<SelectedTrigger[]>(
    trade.triggerRules.map(t => ({ triggerRuleId: t.triggerRuleId, isPrimary: t.isPrimary }))
  )

  // OPEN-only fields
  const [exitPrice, setExitPrice] = useState(trade.exitPrice?.toString() ?? '')
  const [hasRuleBreak, setHasRuleBreak] = useState(false)
  const [breakType, setBreakType] = useState('EARLY_EXIT')
  const [ruleDescription, setRuleDescription] = useState('')
  const [actualExitPrice, setActualExitPrice] = useState('')
  const [ruleExitPrice, setRuleExitPrice] = useState('')
  const [rbNotes, setRbNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/setups/${trade.setupId}/trigger-rules`)
      .then(r => r.json())
      .then(setAvailableRules)
      .catch(() => setAvailableRules([]))
  }, [trade.setupId])

  function handleTriggerClick(ruleId: string) {
    setSelectedTriggers(prev => {
      const existing = prev.find(t => t.triggerRuleId === ruleId)
      if (!existing) {
        return [...prev, { triggerRuleId: ruleId, isPrimary: false }]
      }
      if (!existing.isPrimary) {
        return prev.map(t =>
          t.triggerRuleId === ruleId ? { ...t, isPrimary: true } : { ...t, isPrimary: false }
        )
      }
      return prev.filter(t => t.triggerRuleId !== ruleId)
    })
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)

      const body: Record<string, unknown> = {
        thesis: thesis || null,
        notes: notes || null,
        triggerRules: selectedTriggers,
      }

      if (isOpen && exitPrice.trim()) {
        body.exitPrice = exitPrice
        if (hasRuleBreak && ruleDescription.trim()) {
          body.ruleBreak = {
            breakType,
            ruleDescription,
            actualExitPrice: actualExitPrice || exitPrice,
            ruleExitPrice: ruleExitPrice || null,
            notes: rbNotes || null,
          }
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
          throw new Error(JSON.stringify(data.error ?? 'Failed to save'))
        }

        router.refresh()
        onDone()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    },
    [
      thesis, notes, selectedTriggers, isOpen, exitPrice,
      hasRuleBreak, breakType, ruleDescription, actualExitPrice,
      ruleExitPrice, rbNotes, trade.id, router, onDone,
    ]
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Thesis */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-ink-secondary)]">
          Entry Thesis
        </label>
        <textarea
          rows={3}
          placeholder="Why did you take this trade?"
          value={thesis}
          onChange={e => setThesis(e.target.value)}
          maxLength={2000}
          className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none transition-colors"
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-ink-secondary)]">
          Notes
        </label>
        <textarea
          rows={3}
          placeholder="Post-trade reflection, lessons learned…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={5000}
          className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none transition-colors"
        />
      </div>

      {/* Trigger rules */}
      {availableRules.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-ink-secondary)]">
            Trigger Rules
            <span className="ml-1 font-normal text-[var(--color-ink-muted)]">
              (once = confluence, twice = primary, thrice = remove)
            </span>
          </span>
          <div className="flex flex-col gap-1">
            {availableRules.map(rule => {
              const sel = selectedTriggers.find(t => t.triggerRuleId === rule.id)
              const isPrimary = sel?.isPrimary ?? false
              const isConfluence = sel && !isPrimary
              return (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => handleTriggerClick(rule.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] border text-left transition-all cursor-pointer ${
                    isPrimary
                      ? 'bg-[var(--color-ink)] border-[var(--color-ink)]'
                      : isConfluence
                      ? 'bg-[var(--color-surface-sunken)] border-[var(--color-accent)]'
                      : 'bg-transparent border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]'
                  }`}
                  style={{ borderWidth: '0.5px' }}
                >
                  <span
                    className={`shrink-0 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded ${
                      isPrimary ? 'text-[var(--color-surface)]' : directionColors[rule.direction]
                    }`}
                  >
                    {rule.precedence}
                  </span>
                  <span
                    className={`flex-1 text-xs ${isPrimary ? 'text-[var(--color-surface)]' : 'text-[var(--color-ink)]'}`}
                  >
                    {rule.name}
                  </span>
                  {isPrimary && (
                    <span className="text-[10px] font-semibold text-[var(--color-surface)] uppercase tracking-wide">
                      PRIMARY
                    </span>
                  )}
                  {isConfluence && (
                    <span className="text-[10px] text-[var(--color-accent)]">confluence</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Exit fields — OPEN only */}
      {isOpen && (
        <>
          <Input
            label="Exit Price"
            placeholder="0.00"
            inputMode="decimal"
            value={exitPrice}
            onChange={e => setExitPrice(e.target.value)}
            className="font-mono"
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="editHasRuleBreak"
              checked={hasRuleBreak}
              onChange={e => setHasRuleBreak(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
            />
            <label
              htmlFor="editHasRuleBreak"
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
                onChange={e => setBreakType(e.target.value)}
              />

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-ink-secondary)]">
                  Rule That Was Broken
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Must exit full position at T1"
                  value={ruleDescription}
                  onChange={e => setRuleDescription(e.target.value)}
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
                  onChange={e => setActualExitPrice(e.target.value)}
                  className="font-mono"
                />
                <Input
                  label="Rule Exit Price"
                  placeholder="Where should you have exited?"
                  inputMode="decimal"
                  value={ruleExitPrice}
                  onChange={e => setRuleExitPrice(e.target.value)}
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
                  onChange={e => setRbNotes(e.target.value)}
                  maxLength={2000}
                  className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-loss)] resize-none transition-colors"
                />
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="text-xs text-[var(--color-loss)] bg-[var(--color-loss-bg)] px-3 py-2 rounded-[var(--radius-md)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : isOpen && exitPrice.trim() ? 'Save & Close Trade' : 'Save Changes'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
