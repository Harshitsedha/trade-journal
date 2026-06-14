import { Header } from '@/components/layout/Header'
import { InstrumentsClient } from '@/components/settings/InstrumentsClient'
import { db } from '@/lib/db'

export default async function InstrumentsSettingsPage() {
  const instruments = await db.instrument.findMany({ orderBy: { symbol: 'asc' } })

  // Decimal/Date aren't serializable across the server→client boundary as-is;
  // hand the client plain JSON.
  const initial = instruments.map(i => ({
    id: i.id,
    symbol: i.symbol,
    name: i.name,
    factor: i.factor,
    factorOp: i.factorOp,
    currency: i.currency,
  }))

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="Instruments"
        subtitle="Per-instrument PnL factor — multiply or divide currency PnL by a constant"
      />
      <div className="flex-1 overflow-auto">
        <InstrumentsClient initial={initial} />
      </div>
    </div>
  )
}
