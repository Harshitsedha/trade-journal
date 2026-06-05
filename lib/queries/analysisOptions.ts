import { db } from '@/lib/db'

export interface AnalysisOptions {
  setups: { id: string; name: string }[]
  subSetups: { id: string; setupId: string; name: string }[]
  instruments: string[]
  tags: { id: string; name: string; setupId: string }[]
}

export async function getAnalysisOptions(): Promise<AnalysisOptions> {
  const [setups, subSetups, instrumentRows, tags] = await Promise.all([
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
  ])

  return {
    setups,
    subSetups,
    instruments: instrumentRows.map(r => r.instrument),
    tags,
  }
}
