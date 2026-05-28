'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Setup, SubSetup } from '@/types'

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

  // Form state
  const [instrument, setInstrument] = useState('')
  const [assetClass, setAssetClass] = useState('FUTURES')
  const [expiry, setExpiry] = useState('')
  const [setupId, setSetupId] = useState('')
  const [subSetupId, setSubSetupId] = useState('')
  const [subSetups, setSubSetups] = useState<SubSetup[]>([])
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

  // Load sub-setups when setup changes
  useEffect(() => {
    if (!setupId) return
    fetch(`/api/setups/${setupId}/subsetups`)
      .then((r) => r.json())
      .then(setSubSetups)
      .catch(() => setSubSetups([]))
  }, [setupId])

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
      setLoading(true)
      setError(null)

      const targets = [target1, target2, target3].filter(Boolean)

      try {
        const res = await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instrument: instrument.toUpperCase().trim(),
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
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(JSON.stringify(data.error ?? 'Failed to save trade'))
        }

        const trade = await res.json()
        router.push(`/trades/${trade.id}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    },
    [
      canSubmit, instrument, assetClass, expiry, setupId, subSetupId,
      direction, entryPrice, stopLoss, target1, target2, target3,
      quantity, riskAmount, thesis, tradeDate, router,
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
          label="Risk Amount (₹)"
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
        {loading ? 'Saving…' : 'Save Trade Entry'}
      </Button>
    </form>
  )
}
