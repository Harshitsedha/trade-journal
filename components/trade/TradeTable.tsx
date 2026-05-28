import type { TradeWithRelations } from '@/types'
import { TradeCard } from './TradeCard'

interface TradeTableProps {
  trades: TradeWithRelations[]
  total: number
  page: number
  limit: number
}

export function TradeTable({ trades, total, page, limit }: TradeTableProps) {
  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--color-ink-muted)]">
        <p className="text-sm">No trades yet.</p>
        <p className="text-xs mt-1">Log your first trade to get started.</p>
      </div>
    )
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex flex-col">
      {/* Column headers */}
      <div
        className="flex items-center gap-4 px-5 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]"
        style={{ borderWidth: '0.5px' }}
      >
        <span className="flex-1 text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
          Trade
        </span>
        <div className="flex items-center gap-4 flex-shrink-0 pr-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            R
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            P&L
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
            Status
          </span>
        </div>
      </div>

      {/* Rows */}
      <div>
        {trades.map((trade) => (
          <TradeCard key={trade.id} trade={trade} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]" style={{ borderWidth: '0.5px' }}>
          <span className="text-xs text-[var(--color-ink-muted)]">
            {total} trades · page {page} of {totalPages}
          </span>
        </div>
      )}
    </div>
  )
}
