import type { DashboardStats } from '@/types'
import { currencySymbol } from '@/lib/currency'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  variant?: 'default' | 'profit' | 'loss'
}

function StatCard({ label, value, sub, variant = 'default' }: StatCardProps) {
  const valueColor =
    variant === 'profit'
      ? 'text-[var(--color-profit)]'
      : variant === 'loss'
      ? 'text-[var(--color-loss)]'
      : 'text-[var(--color-ink)]'

  return (
    <div
      className="flex-1 min-w-[140px] px-5 py-4 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)]"
      style={{ borderWidth: '0.5px' }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold font-mono tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{sub}</p>}
    </div>
  )
}

interface StatStripProps {
  stats: DashboardStats
}

export function StatStrip({ stats }: StatStripProps) {
  // One row of cards per currency — P&L is never summed across currencies.
  // Hide a currency's row until it has ≥ 1 closed trade, so empty rows (e.g. INR
  // with 0 closed trades) don't show noise like "0.0% win / +₹0 realised".
  const currencies = stats.byCurrency.filter(c => c.totalClosed >= 1)

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <div className="flex flex-wrap gap-3">
        <StatCard label="Open Trades" value={String(stats.openTrades)} sub="currently running" />
      </div>
      {currencies.map(c => {
        const pnlPositive = c.totalPnl >= 0
        const dragPositive = c.executionDrag >= 0
        const sym = currencySymbol(c.currency || undefined)
        return (
          <div key={c.currency || 'none'} className="flex flex-wrap gap-3 items-stretch">
            <div className="flex items-center px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] min-w-[52px]">
              {c.currency || '—'}
            </div>
            <StatCard
              label="Total Actual P&L"
              value={`${pnlPositive ? '+' : ''}${sym}${Math.abs(c.totalPnl).toLocaleString('en-IN')}`}
              sub="realised"
              variant={pnlPositive ? 'profit' : 'loss'}
            />
            <StatCard
              label="Execution Drag"
              value={`${dragPositive ? '+' : '−'}${sym}${Math.abs(c.executionDrag).toLocaleString('en-IN')}`}
              sub="actual − ideal"
              variant={dragPositive ? 'profit' : 'loss'}
            />
            <StatCard
              label="Win Rate"
              value={`${(c.winRate ?? 0).toFixed(1)}%`}
              variant={c.winRate >= 50 ? 'profit' : 'loss'}
            />
            <StatCard
              label="Avg R"
              value={`${c.avgRMultiple >= 0 ? '+' : ''}${(c.avgRMultiple ?? 0).toFixed(2)}R`}
              sub="per closed trade"
              variant={c.avgRMultiple >= 0 ? 'profit' : 'loss'}
            />
            <StatCard label="Trades" value={String(c.totalClosed)} sub="closed" />
          </div>
        )
      })}
    </div>
  )
}
