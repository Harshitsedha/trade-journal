'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Setup, SubSetup } from '@/types'
import type { TriggerRule, TriggerDirection } from '@/generated/prisma/client'
import { currencySymbol } from '@/lib/currency'

interface SelectedTrigger {
  triggerRuleId: string
  isPrimary: boolean
}

const directionColors: Record<TriggerDirection, string> = {
  LONG: 'text-[var(--color-profit)]',
  SHORT: 'text-[var(--color-loss)]',
  BOTH: 'text-[var(--color-accent)]',
}

interface TradeFormProps {
  setups: Setup[]
}

const ASSET_OPTIONS = [
  { value: 'FUTURES', label: 'Futures' },
  { value: 'OPTIONS', label: 'Options' },
  { value: 'EQUITY', label: 'Equity' },
]

function computeRR(entry: string, stop: string, target: string): string {
  try {
    const e = new Decimal(entry)
    const s = new Decimal(stop)
    const t = new Decimal(target)
    const risk = e.minus(s).abs()
    if (risk.isZero()) return '—'
    const reward = t.minus(e).abs()
    return `${reward.div(risk).toFixed(2)}R`
  } catch {
    return '—'
  }
}

export function TradeForm({ setups }: TradeFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Synchronous single-flight latch. A ref (not `loading` state) because state
  // updates are async — a fast second click would beat the re-render that
  // disables the button. Once a submit starts it stays latched on the success
  // path (we navigate away and never re-arm); only an error clears it for retry.
  const submittingRef = useRef(false)
  // Idempotency key — one per trade, fixed for the life of this mounted form.
  // It rotates ONLY when a fresh form mounts (this initializer), so any accidental
  // re-fire from the same form reuses the id and the server's P2002 catch collapses
  // it to a single row. Do NOT regenerate it on success.
  const [clientRequestId] = useState(() => crypto.randomUUID())

  // Form state
  const [instrument, setInstrument] = useState('')
  // Optional link to a configured Instrument → its PnL factor applies on create.
  // Empty = no link = factor-1 fallback (behaves exactly as before).
  const [instrumentId, setInstrumentId] = useState('')
  const [instruments, setInstruments] = useState<
    { id: string; symbol: string; name: string; factor: number; factorOp: string; currency: string }[]
  >([])
  const [assetClass, setAssetClass] = useState('FUTURES')
  const [expiry, setExpiry] = useState('')
  const [setupId, setSetupId] = useState('')
  const [subSetupId, setSubSetupId] = useState('')
  const [subSetups, setSubSetups] = useState<SubSetup[]>([])
  const [triggerRules, setTriggerRules] = useState<TriggerRule[]>([])
  const [selectedTriggers, setSelectedTriggers] = useState<SelectedTrigger[]>([])
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [target1, setTarget1] = useState('')
  const [target2, setTarget2] = useState('')
  const [target3, setTarget3] = useState('')
  const [quantity, setQuantity] = useState('')
  const [riskAmount, setRiskAmount] = useState('')
  const [thesis, setThesis] = useState('')
  const [tradeDate, setTradeDate] = useState(
    new Date().toISOString().slice(0, 16)
  )
  // Outcome at log time: TAKEN (OPEN) vs not-taken (MISSED/SKIP), plus the ideal exit
  // used to grade execution / track the cost of a skip.
  const [status, setStatus] = useState<'OPEN' | 'MISSED' | 'SKIP'>('OPEN')
  const [idealExit, setIdealExit] = useState('')
  // Manual PnL override (actual USD). Blank = calculated; filled = override mode.
  const [pnlOverride, setPnlOverride] = useState('')

  // Load configured instruments once for the link selector.
  useEffect(() => {
    fetch('/api/instruments')
      .then(r => r.json())
      .then(d => setInstruments(Array.isArray(d) ? d : []))
      .catch(() => setInstruments([]))
  }, [])

  // Load sub-setups and trigger rules when setup changes
  useEffect(() => {
    if (!setupId) {
      setSubSetups([])
      setTriggerRules([])
      setSelectedTriggers([])
      return
    }
    Promise.all([
      fetch(`/api/setups/${setupId}/subsetups`).then(r => r.json()).catch(() => []),
      fetch(`/api/setups/${setupId}/trigger-rules`).then(r => r.json()).catch(() => []),
    ]).then(([subs, rules]) => {
      setSubSetups(subs)
      setTriggerRules(rules)
      setSelectedTriggers([])
    })
  }, [setupId])

  function handleTriggerClick(ruleId: string) {
    setSelectedTriggers(prev => {
      const existing = prev.find(t => t.triggerRuleId === ruleId)
      if (!existing) {
        // Not selected → select as CONFLUENCE
        return [...prev, { triggerRuleId: ruleId, isPrimary: false }]
      }
      if (!existing.isPrimary) {
        // CONFLUENCE → toggle to PRIMARY (demote current primary first)
        return prev.map(t =>
          t.triggerRuleId === ruleId
            ? { ...t, isPrimary: true }
            : { ...t, isPrimary: false }
        )
      }
      // Already PRIMARY → deselect
      return prev.filter(t => t.triggerRuleId !== ruleId)
    })
  }

  const rr = computeRR(entryPrice, stopLoss, target1)
  const needsExpiry = assetClass === 'FUTURES' || assetClass === 'OPTIONS'

  const canSubmit =
    instrument.trim() &&
    setupId &&
    entryPrice &&
    stopLoss &&
    target1 &&
    quantity &&
    riskAmount &&
    tradeDate

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSubmit) return
      // Synchronous single-flight guard. Blocks any second submit — including a
      // deliberate click seconds later while router.push is still resolving and
      // the form is briefly re-displayed — because the ref flips before the next
      // event loop turn, independent of React's async state.
      if (submittingRef.current) return
      submittingRef.current = true
      setLoading(true)
      setError(null)

      const targets = [target1, target2, target3].filter(Boolean)

      try {
        const res = await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instrument: instrument.toUpperCase().trim(),
            instrumentId: instrumentId || null,
            assetClass,
            expiry: expiry ? new Date(expiry).toISOString() : null,
            setupId,
            subSetupId: subSetupId || null,
            direction,
            entryPrice,
            stopLoss,
            targets,
            quantity,
            riskAmount,
            thesis: thesis || null,
            notes: null,
            tradeDate: new Date(tradeDate).toISOString(),
            triggerRules: selectedTriggers.length > 0 ? selectedTriggers : undefined,
            status: status !== 'OPEN' ? status : undefined,
            idealExit: idealExit.trim() || null,
            pnlOverride: pnlOverride.trim() ? Number(pnlOverride) : null,
            clientRequestId,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(JSON.stringify(data.error ?? 'Failed to save trade'))
        }

        const trade = await res.json()
        // Success: navigate away and DELIBERATELY stay latched — do not clear
        // submittingRef or loading. We do NOT call router.refresh() here: pairing
        // it with router.push raced the navigation and left this form mounted and
        // re-armed (the duplicate-submit window). The dashboard/list are kept fresh
        // by revalidatePath() on the server instead.
        router.push(`/trades/${trade.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        // Only a real failure re-arms the form for a retry.
        submittingRef.current = false
        setLoading(false)
      }
    },
    [
      canSubmit, instrument, instrumentId, assetClass, expiry, setupId, subSetupId,
      direction, entryPrice, stopLoss, target1, target2, target3,
      quantity, riskAmount, thesis, tradeDate, selectedTriggers, router,
      status, idealExit, pnlOverride, clientRequestId,
    ]
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6 max-w-lg">
      {/* Direction toggle */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--color-ink-secondary)]">Direction</span>
        <div className="flex gap-2">
          {(['LONG', 'SHORT'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`flex-1 py-3 rounded-[var(--radius-md)] text-sm font-semibold border transition-all cursor-pointer ${
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

      {/* Linked instrument (optional) — drives the PnL factor. None = factor 1. */}
      {instruments.length > 0 && (
        <Select
          label="Linked Instrument (factor)"
          placeholder="— None (factor 1) —"
          value={instrumentId}
          onChange={(e) => {
            const id = e.target.value
            setInstrumentId(id)
            // Auto-fill the instrument string from the chosen symbol so the old
            // free-text field stays consistent (used for backfill matching).
            const picked = instruments.find(i => i.id === id)
            if (picked) setInstrument(picked.symbol)
          }}
          options={instruments.map(i => ({
            value: i.id,
            label: `${i.symbol} · ${i.factorOp === 'DIVIDE' ? '÷' : '×'}${i.factor} · ${i.name}`,
          }))}
        />
      )}

      {/* Instrument + Asset */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Instrument"
          placeholder="NIFTY50"
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
        />
        <Select
          label="Asset Class"
          options={ASSET_OPTIONS}
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value)}
        />
      </div>

      {/* Expiry — only for Futures/Options */}
      {needsExpiry && (
        <Input
          label="Expiry"
          type="datetime-local"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
        />
      )}

      {/* Setup cascade */}
      <Select
        label="Setup"
        placeholder="Select setup..."
        value={setupId}
        onChange={(e) => { setSetupId(e.target.value); setSubSetupId(''); setSubSetups([]) }}
        options={setups.map((s) => ({ value: s.id, label: s.name }))}
      />
      {subSetups.length > 0 && (
        <Select
          label="Sub-Setup (optional)"
          placeholder="Select sub-setup..."
          value={subSetupId}
          onChange={(e) => setSubSetupId(e.target.value)}
          options={subSetups.map((s) => ({ value: s.id, label: s.name }))}
        />
      )}

      {/* Trigger Rules */}
      {triggerRules.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-ink-secondary)]">
            Trigger Rules
            <span className="ml-1 text-[var(--color-ink-muted)] font-normal">
              (click once = confluence, click again = primary, click again = remove)
            </span>
          </span>
          <div className="flex flex-col gap-1">
            {triggerRules.map(rule => {
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
                    className={`flex-1 text-xs ${
                      isPrimary ? 'text-[var(--color-surface)]' : 'text-[var(--color-ink)]'
                    }`}
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
          {selectedTriggers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedTriggers.map(sel => {
                const rule = triggerRules.find(r => r.id === sel.triggerRuleId)
                if (!rule) return null
                return (
                  <span
                    key={sel.triggerRuleId}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                      sel.isPrimary
                        ? 'bg-[var(--color-ink)] text-[var(--color-surface)]'
                        : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-secondary)] border border-[var(--color-border)]'
                    }`}
                    style={{ borderWidth: sel.isPrimary ? '0' : '0.5px' }}
                  >
                    R{rule.precedence} {sel.isPrimary ? '· PRIMARY' : ''}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Pricing */}
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Entry Price"
          placeholder="0.00"
          inputMode="decimal"
          value={entryPrice}
          onChange={(e) => setEntryPrice(e.target.value)}
          className="font-mono"
        />
        <Input
          label="Stop Loss"
          placeholder="0.00"
          inputMode="decimal"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
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
          onChange={(e) => setTarget1(e.target.value)}
          className="font-mono"
        />
        <Input
          label="Target 2 (opt)"
          placeholder="0.00"
          inputMode="decimal"
          value={target2}
          onChange={(e) => setTarget2(e.target.value)}
          className="font-mono"
        />
        <Input
          label="Target 3 (opt)"
          placeholder="0.00"
          inputMode="decimal"
          value={target3}
          onChange={(e) => setTarget3(e.target.value)}
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
          onChange={(e) => setQuantity(e.target.value)}
          className="font-mono"
        />
        <Input
          label={`Risk Amount (${currencySymbol(instruments.find(i => i.id === instrumentId)?.currency)})`}
          placeholder="0.00"
          inputMode="decimal"
          value={riskAmount}
          onChange={(e) => setRiskAmount(e.target.value)}
          className="font-mono"
        />
      </div>

      {/* Trade date */}
      <Input
        label="Trade Date & Time"
        type="datetime-local"
        value={tradeDate}
        onChange={(e) => setTradeDate(e.target.value)}
      />

      {/* Outcome / status */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--color-ink-secondary)]">Outcome</span>
        <div className="flex gap-2">
          {(['OPEN', 'MISSED', 'SKIP'] as const).map((s) => {
            const selectedClass =
              s === 'MISSED'
                ? 'bg-[var(--color-loss-bg)] text-[var(--color-loss)] border-[var(--color-loss)]'
                : s === 'SKIP'
                ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)] border-[var(--color-accent)]'
                : 'bg-[var(--color-ink)] text-[var(--color-surface)] border-[var(--color-ink)]'
            const label = s === 'OPEN' ? 'TAKEN' : s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-[var(--radius-md)] text-xs font-semibold border transition-all cursor-pointer ${
                  status === s
                    ? selectedClass
                    : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-secondary)] border-[var(--color-border)]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        {status !== 'OPEN' && (
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            {status === 'SKIP'
              ? 'You saw it and consciously passed. Set an Ideal Exit to track the cost of skipping.'
              : 'You missed the entry. Set an Ideal Exit to track the missed move.'}
          </p>
        )}
      </div>

      {/* Ideal Exit — grades execution; drives executionPnl. */}
      <div className="flex flex-col gap-1">
        <Input
          label="Ideal Exit (optional)"
          placeholder="0.00"
          inputMode="decimal"
          value={idealExit}
          onChange={(e) => setIdealExit(e.target.value)}
          className="font-mono"
        />
        <span className="text-[11px] text-[var(--color-ink-muted)]">
          Best exit available — use the entry price for a breakeven (BE) ideal.
        </span>
      </div>

      {/* Manual PnL override — hand-enter the actual USD; blank = calculated. */}
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
          Set the real USD PnL — an implied factor scales executionPnl/rule-break impact to match. rMultiple is unaffected.
        </span>
      </div>

      {/* Thesis */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-ink-secondary)]">
          Entry Thesis (optional)
        </label>
        <textarea
          rows={3}
          placeholder="Why are you taking this trade?"
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          maxLength={2000}
          className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none transition-colors"
        />
      </div>

      {error && (
        <p className="text-xs text-[var(--color-loss)] bg-[var(--color-loss-bg)] px-3 py-2 rounded-[var(--radius-md)]">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!canSubmit || loading}>
        {loading ? 'Logging…' : 'Save Trade Entry'}
      </Button>
    </form>
  )
}
