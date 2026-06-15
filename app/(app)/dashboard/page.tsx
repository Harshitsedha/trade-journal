import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { TradeTable } from '@/components/trade/TradeTable'
import { StatStrip } from '@/components/trade/StatStrip'
import { DashboardEquity } from '@/components/trade/DashboardEquity'
import { getDashboardTrades, getDashboardStats, getDashboardEquity, getSetups } from '@/lib/queries/trades'
import { Button } from '@/components/ui/Button'
import type { TradeWithRelations } from '@/types'

interface DashboardPageProps {
  searchParams: Promise<{ setupId?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { setupId } = await searchParams

  // The trades table is filtered by the sidebar's setup link (?setupId=…); the
  // equity curves and stat strip always reflect ALL trades, never the filter.
  const [trades, stats, equity, setups] = await Promise.all([
    getDashboardTrades(setupId),
    getDashboardStats(),
    getDashboardEquity(),
    setupId ? getSetups() : Promise.resolve([]),
  ])

  const activeSetup = setupId ? setups.find(s => s.id === setupId) : null

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="Dashboard"
        subtitle="Your trade journal"
        actions={
          <Link href="/trades/new">
            <Button size="sm">+ Log Trade</Button>
          </Link>
        }
      />
      {/* Equity curve up top — Actual vs Possible (ideal) with execution-drag band */}
      <DashboardEquity series={equity} />

      {/* Trades table sits right under the charts so it's visible without scrolling
          past all the analytics; the stat cards follow below. */}
      {setupId && (
        <div className="mx-6 mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-xs text-[var(--color-ink-secondary)]" style={{ borderWidth: '0.5px' }}>
            <span className="text-[var(--color-ink-muted)]">Filtered by:</span>
            <span className="font-medium text-[var(--color-ink)]">{activeSetup?.name ?? 'Unknown setup'}</span>
            <Link
              href="/dashboard"
              className="text-[var(--color-ink-muted)] hover:text-[var(--color-loss)] transition-colors"
              title="Clear filter"
            >
              ✕
            </Link>
          </span>
        </div>
      )}
      <div className="mt-3 max-h-[600px] overflow-y-auto">
        <TradeTable
          trades={trades as TradeWithRelations[]}
          total={trades.length}
          page={1}
          limit={Math.max(trades.length, 1)}
        />
      </div>

      <StatStrip stats={stats} />
    </div>
  )
}
