import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { TradeTable } from '@/components/trade/TradeTable'
import { StatStrip } from '@/components/trade/StatStrip'
import { DashboardEquity } from '@/components/trade/DashboardEquity'
import { getDashboardTrades, getDashboardStats, getDashboardEquity } from '@/lib/queries/trades'
import { Button } from '@/components/ui/Button'
import type { TradeWithRelations } from '@/types'

export default async function DashboardPage() {
  // Show EVERY trade — no pagination cap. Ordered OPEN → CLOSED → MISSED in the query.
  const [trades, stats, equity] = await Promise.all([
    getDashboardTrades(),
    getDashboardStats(),
    getDashboardEquity(),
  ])

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
      <StatStrip stats={stats} />
      <div className="flex-1 overflow-auto">
        <TradeTable
          trades={trades as TradeWithRelations[]}
          total={trades.length}
          page={1}
          limit={Math.max(trades.length, 1)}
        />
      </div>
    </div>
  )
}
