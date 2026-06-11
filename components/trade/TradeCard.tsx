'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Decimal from 'decimal.js'
import type { TradeWithRelations } from '@/types'
import { Badge } from '@/components/ui/Badge'

interface TradeCardProps {
  trade: TradeWithRelations
}

export function TradeCard({ trade }: TradeCardProps) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const r = trade.rMultiple ? new Decimal(trade.rMultiple.toString()) : null
  const pnl = trade.pnl ? new Decimal(trade.pnl.toString()) : null
  const entryRuleCorrect: boolean | null = (trade as Record<string, unknown>).entryRuleCorrect as boolean | null ?? null

  function statusBadgeVariant(status: string) {
    if (status === 'CLOSED') return 'profit'
    if (status === 'MISSED' || status === 'SKIP') return 'muted'
    return 'open'
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDeleting(true)
    try {
      await fetch(`/api/trades/${trade.id}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-raised)] transition-colors"
      style={{ borderWidth: '0.5px' }}
    >
      {/* Clickable trade info area */}
      <Link
        href={`/trades/${trade.id}`}
        className="flex-1 min-w-0 flex items-center gap-4"
      >
        {/* Instrument + Setup */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-[var(--color-ink)] font-mono">
              {trade.instrument}
            </span>
            <Badge variant={trade.direction === 'LONG' ? 'accent' : 'loss'}>
              {trade.direction}
            </Badge>
            <span className="text-xs text-[var(--color-ink-muted)]">{trade.setup.name}</span>
            {trade.subSetup && (
              <span className="text-xs text-[var(--color-ink-muted)]">· {trade.subSetup.name}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-[var(--color-ink-muted)] font-mono">
              Entry {trade.entryPrice.toString()}
            </span>
            <span className="text-xs text-[var(--color-ink-muted)] font-mono">
              SL {trade.stopLoss.toString()}
            </span>
            <span className="text-xs text-[var(--color-ink-muted)]">
              {new Date(trade.tradeDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {entryRuleCorrect === true && (
            <Badge variant="profit">Rules ✓</Badge>
          )}
          {entryRuleCorrect === false && (
            <Badge variant="loss">Rules ✗</Badge>
          )}
          {r !== null && (
            <span
              className={`font-mono text-sm font-semibold ${
                r.gt(0) ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'
              }`}
            >
              {r.gt(0) ? '+' : ''}{r.toFixed(2)}R
            </span>
          )}
          {pnl !== null && (
            <span
              className={`font-mono text-sm ${
                pnl.gt(0) ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'
              }`}
            >
              {pnl.gt(0) ? '+' : ''}₹{pnl.toFixed(0)}
            </span>
          )}
          <Badge variant={statusBadgeVariant(trade.status) as 'profit' | 'loss' | 'open' | 'accent' | 'muted'}>
            {trade.status}
          </Badge>
        </div>
      </Link>

      {/* Delete controls — outside the Link */}
      <div className="flex-shrink-0 flex items-center gap-1 pl-2">
        {!confirmDelete ? (
          <button
            onClick={e => { e.preventDefault(); setConfirmDelete(true) }}
            className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-loss)] transition-colors px-1.5 py-1 cursor-pointer"
            title="Delete trade"
          >
            ✕
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--color-loss)]">Delete this trade? This cannot be undone.</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-[11px] font-medium text-[var(--color-loss)] hover:underline cursor-pointer disabled:opacity-50"
            >
              {deleting ? '…' : 'Yes'}
            </button>
            <button
              onClick={e => { e.preventDefault(); setConfirmDelete(false) }}
              className="text-[11px] text-[var(--color-ink-muted)] hover:underline cursor-pointer"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
