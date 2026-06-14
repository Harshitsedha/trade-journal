import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { TradeTable } from '@/components/trade/TradeTable'
import { StatStrip } from '@/components/trade/StatStrip'
import { DashboardEquity } from '@/components/trade/DashboardEquity'
import { getTrades, getDashboardStats, getDashboardEquity } from '@/lib/queries/trades'
import { TradeFilterSchema } from '@/lib/validations/trade'
import { Button } from '@/components/ui/Button'
import type { TradeWithRelations } from '@/types'

interface DashboardPageProps {
  searchParams: Promise<Record<string, string>>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const filters = TradeFilterSchema.parse({
    status: params.status,
    setupId: params.setup,
    assetClass: params.asset,
    page: params.page ?? '1',
    limit: params.limit ?? '20',
  })

  const [{ trades, total, page, limit }, stats, equity] = await Promise.all([
    getTrades(filters),
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
        <TradeTable trades={trades as TradeWithRelations[]} total={total} page={page} limit={limit} />
      </div>
    </div>
  )
}
