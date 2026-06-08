'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Setup, SubSetup, TradeWithRelations, TriggerRule, TriggerDirection } from '@/types'

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

const ASSET_OPTIONS = [
  { value: 'FUTURES', label: 'Futures' },
  { value: 'OPTIONS', label: 'Options' },
  { value: 'EQUITY', label: 'Equity' },
]

const directionColors: Record<TriggerDirection, string> = {
  LONG: 'text-[var(--color-profit)]',
  SHORT: 'text-[var(--color-loss)]',
  BOTH: 'text-[var(--color-accent)]',
}

function computeRR(entry: string, stop: string, target: string): string {
  try {
    const e = new Decimal(entry)
    const s = new Decimal(stop)
    const t = new Decimal(target)
    const risk = e.minus(s).abs()
    if (risk.isZero()) return '—'
    return `${t.minus(e).abs().div(risk).toFixed(2)}R`
  } catch {
    return '—'
  }
}

export function EditTradeForm({ trade, onDone }: EditTradeFormProps) {
  const router = useRouter()
  const isOpen = trade.status === 'OPEN'
  const isFirstSetupLoad = useRef(true)

  // Entry fields — all pre-populated from trade
  const [instrument, setInstrument] = useState(trade.instrument)
  const [assetClass, setAssetClass] = useState(trade.assetClass as string)
  const [expiry, setExpiry] = useState(
    trade.expiry ? new Date(trade.expiry).toISOString().slice(0, 16) : ''
  )
  const [setupId, setSetupId] = useState(trade.setupId)
  const [subSetupId, setSubSetupId] = useState(trade.subSetupId ?? '')
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>(trade.direction as 'LONG' | 'SHORT')
  const [entryPrice, setEntryPrice] = useState(trade.entryPrice.toString())
  const [stopLoss, setStopLoss] = useState(trade.stopLoss.toString())
  const targets0 = (trade.targets as Decimal[]).map(t => t.toString())
  const [target1, setTarget1] = useState(targets0[0] ?? '')
  const [target2, setTarget2] = useState(targets0[1] ?? '')
  const [target3, setTarget3] = useState(targets0[2] ?? '')
  const [quantity, setQuantity] = useState(trade.quantity.toString())
  const [riskAmount, setRiskAmount] = useState(trade.riskAmount.toString())
  const [tradeDate, setTradeDate] = useState(
    new Date(trade.tradeDate).toISOString().slice(0, 16)
  )
  const [thesis, setThesis] = useState(trade.thesis ?? '')
  const [notes, setNotes] = useState(trade.notes ?? '')

  // Cascades
  const [setups, setSetups] = useState<Setup[]>([])
  const [subSetups, setSubSetups] = useState<SubSetup[]>([])
  const [availableRules, setAvailableRules] = useState<TriggerRule[]>([])
  const [selectedTriggers, setSelectedTriggers] = useState<SelectedTrigger[]>(
    trade.triggerRules.map(t => ({ triggerRuleId: t.triggerRuleId, isPrimary: t.isPrimary }))
  )

  // Ideal exit — captured at exit time
  const [idealExit, setIdealExit] = useState(
    (trade as Record<string, unknown>).idealExit != null
      ? String((trade as Record<string, unknown>).idealExit)
      : ''
  )

  // Status toggle for OPEN/MISSED trades
  const [tradeStatus, setTradeStatus] = useState<'OPEN' | 'MISSED' | 'CLOSED'>(
    trade.status as 'OPEN' | 'MISSED' | 'CLOSED'
  )

  // OPEN-only fields
  const [exitPrice, setExitPrice] = useState('')
  const [hasRuleBreak, setHasRuleBreak] = useState(false)
  const [breakType, setBreakType] = useState('EARLY_EXIT')
  const [ruleDescription, setRuleDescription] = useState('')
  const [actualExitPrice, setActualExitPrice] = useState('')
  const [ruleExitPrice, setRuleExitPrice] = useState('')
  const [rbNotes, setRbNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch setups list on mount
  useEffect(() => {
    fetch('/api/setups')
      .then(r => r.json())
      .then(setSetups)
      .catch(() => setSetups([]))
  }, [])

  // Fetch sub-setups + trigger rules when setupId changes
  useEffect(() => {
    if (!setupId) {
      setSubSetups([])
      setAvailableRules([])
      if (!isFirstSetupLoad.current) setSelectedTriggers([])
      return
    }
    Promise.all([
      fetch(`/api/setups/${setupId}/subsetups`).then(r => r.json()).catch(() => []),
      fetch(`/api/setups/${setupId}/trigger-rules`).then(r => r.json()).catch(() => []),
    ]).then(([subs, rules]) => {
      setSubSetups(subs)
      setAvailableRules(rules)
      if (isFirstSetupLoad.current) {
        // Preserve the trade's existing trigger selections on first load
        isFirstSetupLoad.current = false
      } else {
        // User changed setup: clear selections
        setSelectedTriggers([])
      }
    })
  }, [setupId])

  function handleTriggerClick(ruleId: string) {
    setSelectedTriggers(prev => {
      const existing = prev.find(t => t.triggerRuleId === ruleId)
      if (!existing) return [...prev, { triggerRuleId: ruleId, isPrimary: false }]
      if (!existing.isPrimary) {
        return prev.map(t =>
          t.triggerRuleId === ruleId ? { ...t, isPrimary: true } : { ...t, isPrimary: false }
        )
      }
      return prev.filter(t => t.triggerRuleId !== ruleId)
    })
  }

  const needsExpiry = assetClass === 'FUTURES' || assetClass === 'OPTIONS'
  const rr = computeRR(entryPrice, stopLoss, target1)

  const canSubmit =
    instrument.trim() && setupId && entryPrice && stopLoss && target1 && quantity && riskAmount && tradeDate

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSubmit) return
      setLoading(true)
      setError(null)

      const body: Record<string, unknown> = {
        instrument: instrument.toUpperCase().trim(),
        assetClass,
        expiry: expiry ? new Date(expiry).toISOString() : null,
        setupId,
        subSetupId: subSetupId || null,
        direction,
        entryPrice,
        stopLoss,
        targets: [target1, target2, target3].filter(Boolean),
        quantity,
        riskAmount,
        thesis: thesis || null,
        notes: notes || null,
        tradeDate: new Date(tradeDate).toISOString(),
        triggerRules: selectedTriggers,
        status: tradeStatus !== 'CLOSED' ? tradeStatus : undefined,
      }

      if ((isOpen || tradeStatus === 'MISSED') && idealExit.trim()) {
        body.idealExit = idealExit
      }

      if (isOpen && tradeStatus !== 'MISSED' && exitPrice.trim()) {
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
      canSubmit, instrument, assetClass, expiry, setupId, subSetupId,
      direction, entryPrice, stopLoss, target1, target2, target3,
      quantity, riskAmount, thesis, notes, tradeDate, selectedTriggers,
      tradeStatus, idealExit,
      isOpen, exitPrice, hasRuleBreak, breakType, ruleDescription,
      actualExitPrice, ruleExitPrice, rbNotes, trade.id, router, onDone,
    ]
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Direction */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--color-ink-secondary)]">Direction</span>
        <div className="flex gap-2">
          {(['LONG', 'SHORT'] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`flex-1 py-2.5 rounded-[var(--radius-md)] text-sm font-semibold border transition-all cursor-pointer ${
                direction === d
                  ? d === 'LONG'
                    ? 'bg-[var(--color-profit-bg)] text-[var(--color-profit)] border-[var(--color-profit)]'
                    : 'bg-[var(--color-loss-bg)] text-[var(--color-loss)] border-[var(--color-loss)]'
                  : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-secondary)] border-[var(--color-border)]'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Instrument + Asset Class */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Instrument"
          placeholder="NIFTY50"
          value={instrument}
          onChange={e => setInstrument(e.target.value)}
        />
        <Select
          label="Asset Class"
          options={ASSET_OPTIONS}
          value={assetClass}
          onChange={e => setAssetClass(e.target.value)}
        />
      </div>

      {/* Expiry */}
      {needsExpiry && (
        <Input
          label="Expiry"
          type="datetime-local"
          value={expiry}
          onChange={e => setExpiry(e.target.value)}
        />
      )}

      {/* Setup cascade */}
      <Select
        label="Setup"
        placeholder="Select setup..."
        value={setupId}
        onChange={e => { setSetupId(e.target.value); setSubSetupId('') }}
        options={setups.map(s => ({ value: s.id, label: s.name }))}
      />
      {subSetups.length > 0 && (
        <Select
          label="Sub-Setup (optional)"
          placeholder="Select sub-setup..."
          value={subSetupId}
          onChange={e => setSubSetupId(e.target.value)}
          options={subSetups.map(s => ({ value: s.id, label: s.name }))}
        />
      )}

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
                      isPrimary ? 'text-[var(--color-surface)]' : directionColors[rule.direction as TriggerDirection]
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

      {/* Pricing */}
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Entry Price"
          placeholder="0.00"
          inputMode="decimal"
          value={entryPrice}
          onChange={e => setEntryPrice(e.target.value)}
          className="font-mono"
        />
        <Input
          label="Stop Loss"
          placeholder="0.00"
          inputMode="decimal"
          value={stopLoss}
          onChange={e => setStopLoss(e.target.value)}
          className="font-mono"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--color-ink-secondary)]">Live R:R</span>
          <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] font-mono text-sm text-[var(--color-accent)]">
            {rr}
          </div>
        </div>
      </div>

      {/* Targets */}
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Target 1"
          placeholder="0.00"
          inputMode="decimal"
          value={target1}
          onChange={e => setTarget1(e.target.value)}
          className="font-mono"
        />
        <Input
          label="Target 2 (opt)"
          placeholder="0.00"
          inputMode="decimal"
          value={target2}
          onChange={e => setTarget2(e.target.value)}
          className="font-mono"
        />
        <Input
          label="Target 3 (opt)"
          placeholder="0.00"
          inputMode="decimal"
          value={target3}
          onChange={e => setTarget3(e.target.value)}
          className="font-mono"
        />
      </div>

      {/* Sizing */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Quantity / Lots"
          placeholder="1"
          inputMode="decimal"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          className="font-mono"
        />
        <Input
          label="Risk Amount (₹)"
          placeholder="0.00"
          inputMode="decimal"
          value={riskAmount}
          onChange={e => setRiskAmount(e.target.value)}
          className="font-mono"
        />
      </div>

      {/* Trade date */}
      <Input
        label="Trade Date & Time"
        type="datetime-local"
        value={tradeDate}
        onChange={e => setTradeDate(e.target.value)}
      />

      {/* Thesis */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-ink-secondary)]">Entry Thesis</label>
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
        <label className="text-xs font-medium text-[var(--color-ink-secondary)]">Notes</label>
        <textarea
          rows={3}
          placeholder="Post-trade reflection, lessons learned…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={5000}
          className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none transition-colors"
        />
      </div>

      {/* Status toggle — for non-CLOSED trades */}
      {trade.status !== 'CLOSED' && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--color-ink-secondary)]">Status</span>
          <div className="flex gap-2">
            {(['OPEN', 'MISSED'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setTradeStatus(s)}
                className={`flex-1 py-2 rounded-[var(--radius-md)] text-xs font-semibold border transition-all cursor-pointer ${
                  tradeStatus === s
                    ? s === 'MISSED'
                      ? 'bg-[var(--color-loss-bg)] text-[var(--color-loss)] border-[var(--color-loss)]'
                      : 'bg-[var(--color-ink)] text-[var(--color-surface)] border-[var(--color-ink)]'
                    : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-secondary)] border-[var(--color-border)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exit fields — OPEN and MISSED */}
      {(isOpen || tradeStatus === 'MISSED') && (
        <>
          {/* idealExit always shown in exit section */}
          <Input
            label="Ideal Exit (optional)"
            placeholder="0.00"
            inputMode="decimal"
            value={idealExit}
            onChange={e => setIdealExit(e.target.value)}
            className="font-mono"
          />
        </>
      )}

      {/* exitPrice + rule-break — OPEN and not being marked MISSED */}
      {isOpen && tradeStatus !== 'MISSED' && (
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
                <label className="text-xs font-medium text-[var(--color-ink-secondary)]">Reflection</label>
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
        <Button type="submit" disabled={!canSubmit || loading}>
          {loading ? 'Saving…' : isOpen && exitPrice.trim() ? 'Save & Close Trade' : 'Save Changes'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
