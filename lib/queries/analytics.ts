import { db } from '@/lib/db'
import type { TradeForStat } from '@/lib/analytics/compute'

export interface AnalysisFilters {
  from?: Date
  to?: Date
  side?: 'LONG' | 'SHORT'
  setupId?: string
  subSetupId?: string
  instrument?: string
  tagId?: string
  cleanliness?: 'clean' | 'broken'
}

export async function getTradesForAnalysis(f: AnalysisFilters): Promise<TradeForStat[]> {
  const where: Record<string, unknown> = {
    status: 'CLOSED',
    pnl: { not: null },
    rMultiple: { not: null },
  }

  if (f.from || f.to) {
    where.tradeDate = {
      ...(f.from ? { gte: f.from } : {}),
      ...(f.to ? { lte: f.to } : {}),
    }
  }
  if (f.side) where.direction = f.side
  if (f.setupId) where.setupId = f.setupId
  if (f.subSetupId) where.subSetupId = f.subSetupId
  if (f.instrument) where.instrument = f.instrument

  if (f.cleanliness === 'broken') {
    where.ruleBreak = { isNot: null }
  } else if (f.cleanliness === 'clean') {
    where.ruleBreak = null
  }

  if (f.tagId) {
    where.triggerRules = { some: { triggerRuleId: f.tagId } }
  }

  const trades = await db.trade.findMany({
    where,
    include: {
      setup: true,
      subSetup: true,
      ruleBreak: true,
      triggerRules: { include: { triggerRule: true } },
    },
    orderBy: { tradeDate: 'asc' },
  })

  return trades.map(t => ({
    id: t.id,
    tradeDate: t.tradeDate,
    direction: t.direction as 'LONG' | 'SHORT',
    pnl: Number(t.pnl!.toString()),
    rMultiple: Number(t.rMultiple!.toString()),
    instrument: t.instrument,
    setupName: t.setup.name,
    subSetupName: t.subSetup?.name ?? null,
    tagNames: t.triggerRules.map(tr => tr.triggerRule.name),
    hasRuleBreak: t.ruleBreak !== null,
    ruleBreakPnlImpact: t.ruleBreak ? Number(t.ruleBreak.pnlImpact.toString()) : undefined,
    ruleBreakRImpact: t.ruleBreak ? Number(t.ruleBreak.rMultipleImpact.toString()) : undefined,
  }))
}
