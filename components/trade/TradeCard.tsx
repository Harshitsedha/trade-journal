import Link from 'next/link'
import Decimal from 'decimal.js'
import type { TradeWithRelations } from '@/types'
import { Badge } from '@/components/ui/Badge'

interface TradeCardProps {
  trade: TradeWithRelations
}

function statusBadge(status: string) {
  if (status === 'CLOSED') return 'profit'
  if (status === 'SCRATCHED') return 'muted'
  return 'open'
}

function rMultipleBadge(r: string | null) {
  if (!r) return null
  const val = new Decimal(r)
  return val.gt(0) ? 'profit' : 'loss'
}

export function TradeCard({ trade }: TradeCardProps) {
  const r = trade.rMultiple ? new Decimal(trade.rMultiple.toString()) : null
  const pnl = trade.pnl ? new Decimal(trade.pnl.toString()) : null
  const rBadgeVariant = rMultipleBadge(trade.rMultiple?.toString() ?? null)

  return (
    <Link
      href={`/trades/${trade.id}`}
      className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-raised)] transition-colors"
      style={{ borderWidth: '0.5px' }}
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
        {r !== null && rBadgeVariant && (
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
        <Badge variant={statusBadge(trade.status) as 'profit' | 'loss' | 'open' | 'accent' | 'muted'}>
          {trade.status}
        </Badge>
      </div>
    </Link>
  )
}
