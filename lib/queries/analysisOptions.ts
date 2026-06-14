import { db } from '@/lib/db'
import { isCurrencyCode, DEFAULT_CURRENCY } from '@/lib/currency'

export interface AnalysisOptions {
  setups: { id: string; name: string }[]
  subSetups: { id: string; setupId: string; name: string }[]
  instruments: string[]
  tags: { id: string; name: string; setupId: string }[]
  currencies: string[]
}

export async function getAnalysisOptions(): Promise<AnalysisOptions> {
  const [setups, subSetups, instrumentRows, tags, closedCcy] = await Promise.all([
    db.setup.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.subSetup.findMany({ select: { id: true, setupId: true, name: true }, orderBy: { name: 'asc' } }),
    db.trade.findMany({
      where: { status: 'CLOSED' },
      select: { instrument: true },
      distinct: ['instrument'],
      orderBy: { instrument: 'asc' },
    }),
    db.triggerRule.findMany({
      where: { isActive: true },
      select: { id: true, name: true, setupId: true },
      orderBy: { name: 'asc' },
    }),
    db.trade.findMany({
      where: { status: 'CLOSED' },
      select: { instrumentRef: { select: { currency: true } } },
    }),
  ])

  // Currencies actually present among closed trades (unlinked ⇒ app default).
  const ccySet = new Set<string>()
  for (const t of closedCcy) {
    ccySet.add(isCurrencyCode(t.instrumentRef?.currency) ? t.instrumentRef!.currency : DEFAULT_CURRENCY)
  }
  const currencies = ccySet.size > 0 ? Array.from(ccySet).sort() : [DEFAULT_CURRENCY]

  return {
    setups,
    subSetups,
    instruments: instrumentRows.map(r => r.instrument),
    tags,
    currencies,
  }
}
