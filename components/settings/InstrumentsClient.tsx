'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { computeRMultiple } from '@/lib/calculations'
import { computePnl, computeExecutionPnl } from '@/lib/pnl'

interface InstrumentRow {
  id: string
  symbol: string
  name: string
  factor: number
  factorOp: string
}

const OP_OPTIONS = [
  { value: 'MULTIPLY', label: 'Multiply ×' },
  { value: 'DIVIDE', label: 'Divide ÷' },
]

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

export function InstrumentsClient({ initial }: { initial: InstrumentRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<InstrumentRow[]>(initial)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // New-instrument draft
  const [draft, setDraft] = useState({ symbol: '', name: '', factor: '1', factorOp: 'MULTIPLY' })

  // ── Live preview ────────────────────────────────────────────────────────────
  const [pv, setPv] = useState({
    factor: '5000', factorOp: 'MULTIPLY',
    direction: 'LONG' as 'LONG' | 'SHORT',
    entry: '100', stop: '95', exit: '110', idealExit: '112', qty: '2',
  })

  const preview = useMemo(() => {
    const factorNum = Number(pv.factor)
    const instr = Number.isFinite(factorNum) && factorNum > 0
      ? { factor: factorNum, factorOp: pv.factorOp }
      : null // invalid → factor-1 fallback
    try {
      const pnl = computePnl(instr, {
        direction: pv.direction, entryPrice: pv.entry, exitPrice: pv.exit, quantity: pv.qty,
      }).toNumber()
      const execPnl = computeExecutionPnl(instr, {
        direction: pv.direction, entryPrice: pv.entry, idealExit: pv.idealExit,
        quantity: pv.qty, exitPrice: pv.exit,
      })
      const r = computeRMultiple(pv.direction, pv.entry, pv.stop, pv.exit).toNumber()
      // rMultiple with neutral factor — proves the factor never changes it.
      return { pnl, execPnl, r, valid: instr !== null }
    } catch {
      return { pnl: NaN, execPnl: NaN, r: NaN, valid: false }
    }
  }, [pv])

  function updateRow(id: string, patch: Partial<InstrumentRow>) {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function saveRow(row: InstrumentRow) {
    setError(null)
    if (!(row.factor > 0)) { setError(`${row.symbol || 'Instrument'}: factor must be > 0`); return }
    if (!row.symbol.trim() || !row.name.trim()) { setError('Symbol and name are required'); return }
    setSavingId(row.id)
    try {
      const res = await fetch(`/api/instruments/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: row.symbol, name: row.name, factor: row.factor, factorOp: row.factorOp }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteRow(row: InstrumentRow) {
    if (!confirm(`Delete ${row.symbol}? Linked trades revert to factor 1 (their stored PnL is unchanged until a recalc).`)) return
    setError(null)
    setSavingId(row.id)
    try {
      const res = await fetch(`/api/instruments/${row.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error((await res.json()).error ?? 'Delete failed')
      setRows(rs => rs.filter(r => r.id !== row.id))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSavingId(null)
    }
  }

  async function addDraft() {
    setError(null)
    const factorNum = Number(draft.factor)
    if (!(factorNum > 0)) { setError('Factor must be > 0'); return }
    if (!draft.symbol.trim() || !draft.name.trim()) { setError('Symbol and name are required'); return }
    setSavingId('__new__')
    try {
      const res = await fetch('/api/instruments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: draft.symbol, name: draft.name, factor: factorNum, factorOp: draft.factorOp }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Create failed')
      const created: InstrumentRow = await res.json()
      setRows(rs => [...rs, created].sort((a, b) => a.symbol.localeCompare(b.symbol)))
      setDraft({ symbol: '', name: '', factor: '1', factorOp: 'MULTIPLY' })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      {error && (
        <p className="text-xs text-[var(--color-loss)] bg-[var(--color-loss-bg)] px-3 py-2 rounded-[var(--radius-md)]">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_1.4fr_0.9fr_1fr_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
          <span>Symbol</span><span>Name</span><span>Factor</span><span>Operation</span><span></span>
        </div>

        {rows.map(row => {
          const invalid = !(row.factor > 0)
          return (
            <div key={row.id} className="grid grid-cols-[1fr_1.4fr_0.9fr_1fr_auto] gap-2 items-center">
              <Input value={row.symbol} onChange={e => updateRow(row.id, { symbol: e.target.value })} className="font-mono" />
              <Input value={row.name} onChange={e => updateRow(row.id, { name: e.target.value })} />
              <Input
                inputMode="decimal" value={String(row.factor)} className="font-mono"
                onChange={e => updateRow(row.id, { factor: Number(e.target.value) })}
                style={invalid ? { borderColor: 'var(--color-loss)' } : undefined}
              />
              <Select options={OP_OPTIONS} value={row.factorOp} onChange={e => updateRow(row.id, { factorOp: e.target.value })} />
              <div className="flex gap-1">
                <Button size="sm" onClick={() => saveRow(row)} disabled={invalid || savingId === row.id}>
                  {savingId === row.id ? '…' : 'Save'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => deleteRow(row)} disabled={savingId === row.id}>Del</Button>
              </div>
            </div>
          )
        })}

        {/* Add row */}
        <div className="grid grid-cols-[1fr_1.4fr_0.9fr_1fr_auto] gap-2 items-center pt-2 border-t border-[var(--color-border)]" style={{ borderTopWidth: '0.5px' }}>
          <Input placeholder="SILVER" value={draft.symbol} onChange={e => setDraft(d => ({ ...d, symbol: e.target.value }))} className="font-mono" />
          <Input placeholder="Silver CFD (oz)" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <Input placeholder="5000" inputMode="decimal" value={draft.factor} onChange={e => setDraft(d => ({ ...d, factor: e.target.value }))} className="font-mono" />
          <Select options={OP_OPTIONS} value={draft.factorOp} onChange={e => setDraft(d => ({ ...d, factorOp: e.target.value }))} />
          <Button size="sm" onClick={addDraft} disabled={savingId === '__new__'}>{savingId === '__new__' ? '…' : 'Add'}</Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-3 p-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)]" style={{ borderWidth: '0.5px' }}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-secondary)]">Live preview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input label="Factor" inputMode="decimal" value={pv.factor} onChange={e => setPv(p => ({ ...p, factor: e.target.value }))} className="font-mono" />
          <Select label="Operation" options={OP_OPTIONS} value={pv.factorOp} onChange={e => setPv(p => ({ ...p, factorOp: e.target.value }))} />
          <Select label="Direction" options={[{ value: 'LONG', label: 'Long' }, { value: 'SHORT', label: 'Short' }]} value={pv.direction} onChange={e => setPv(p => ({ ...p, direction: e.target.value as 'LONG' | 'SHORT' }))} />
          <Input label="Quantity" inputMode="decimal" value={pv.qty} onChange={e => setPv(p => ({ ...p, qty: e.target.value }))} className="font-mono" />
          <Input label="Entry" inputMode="decimal" value={pv.entry} onChange={e => setPv(p => ({ ...p, entry: e.target.value }))} className="font-mono" />
          <Input label="Stop" inputMode="decimal" value={pv.stop} onChange={e => setPv(p => ({ ...p, stop: e.target.value }))} className="font-mono" />
          <Input label="Exit" inputMode="decimal" value={pv.exit} onChange={e => setPv(p => ({ ...p, exit: e.target.value }))} className="font-mono" />
          <Input label="Ideal exit" inputMode="decimal" value={pv.idealExit} onChange={e => setPv(p => ({ ...p, idealExit: e.target.value }))} className="font-mono" />
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="flex flex-col">
            <span className="text-[11px] text-[var(--color-ink-muted)]">pnl (scaled)</span>
            <span className="font-mono text-sm text-[var(--color-ink)]">{Number.isFinite(preview.pnl) ? fmt(preview.pnl) : '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-[var(--color-ink-muted)]">executionPnl (scaled)</span>
            <span className="font-mono text-sm text-[var(--color-ink)]">{Number.isFinite(preview.execPnl) ? fmt(preview.execPnl) : '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-[var(--color-ink-muted)]">rMultiple (NOT scaled)</span>
            <span className="font-mono text-sm text-[var(--color-accent)]">{Number.isFinite(preview.r) ? `${preview.r.toFixed(2)}R` : '—'}</span>
          </div>
        </div>
        {!preview.valid && (
          <p className="text-[11px] text-[var(--color-loss)]">Factor must be &gt; 0 — preview is using the neutral factor 1.</p>
        )}
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          rMultiple is risk-normalized — change the factor and it never moves. Only pnl and executionPnl scale.
        </p>
      </div>
    </div>
  )
}
