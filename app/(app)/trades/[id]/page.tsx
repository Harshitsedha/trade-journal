import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { TradeDetail } from '@/components/trade/TradeDetail'
import { getTradeById } from '@/lib/queries/trades'
import type { TradeWithRelations } from '@/types'

interface TradePageProps {
  params: Promise<{ id: string }>
}

export default async function TradePage({ params }: TradePageProps) {
  const { id } = await params
  const trade = await getTradeById(id)
  if (!trade) notFound()

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title={trade.instrument}
        subtitle={`${trade.setup.name} · ${trade.direction} · ${trade.assetClass}`}
      />
      <div className="flex-1 overflow-auto">
        <TradeDetail trade={trade as TradeWithRelations} />
      </div>
    </div>
  )
}
