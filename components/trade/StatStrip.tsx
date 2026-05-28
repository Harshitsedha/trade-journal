import type { DashboardStats } from '@/types'

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
      className="flex-1 px-5 py-4 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)]"
      style={{ borderWidth: '0.5px' }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold font-mono ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{sub}</p>}
    </div>
  )
}

interface StatStripProps {
  stats: DashboardStats
}

export function StatStrip({ stats }: StatStripProps) {
  const pnlPositive = stats.totalPnl >= 0
  const rPositive = stats.avgRMultiple >= 0

  return (
    <div className="flex gap-3 px-6 py-4">
      <StatCard
        label="Open Trades"
        value={String(stats.openTrades)}
        sub="currently running"
      />
      <StatCard
        label="Win Rate"
        value={`${stats.winRate.toFixed(1)}%`}
        sub={`${stats.totalClosed} closed`}
        variant={stats.winRate >= 50 ? 'profit' : 'loss'}
      />
      <StatCard
        label="Avg R"
        value={`${stats.avgRMultiple >= 0 ? '+' : ''}${stats.avgRMultiple.toFixed(2)}R`}
        sub="per closed trade"
        variant={rPositive ? 'profit' : 'loss'}
      />
      <StatCard
        label="Total P&L"
        value={`${pnlPositive ? '+' : ''}₹${Math.abs(stats.totalPnl).toLocaleString('en-IN')}`}
        sub="realised"
        variant={pnlPositive ? 'profit' : 'loss'}
      />
    </div>
  )
}
