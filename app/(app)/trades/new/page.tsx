import { Header } from '@/components/layout/Header'
import { TradeForm } from '@/components/trade/TradeForm'
import { getSetups } from '@/lib/queries/trades'

export default async function NewTradePage() {
  const setups = await getSetups()

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Log Trade" subtitle="Record a new trade entry" />
      <div className="flex-1 overflow-auto">
        <TradeForm setups={setups} />
      </div>
    </div>
  )
}
