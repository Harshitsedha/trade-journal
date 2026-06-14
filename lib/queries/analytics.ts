import { TradeStatus, Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { DEFAULT_CURRENCY } from '@/lib/currency'
import { tradeQuality, type TradeForStat, type TradeQuality } from '@/lib/analytics/compute'

// URL/filter slugs for the 3-way quality axis → internal TradeQuality.
export type QualityFilter = 'rule_followed' | 'rule_broken' | 'missed'
const QUALITY_FILTER_MAP: Record<QualityFilter, TradeQuality> = {
  rule_followed: 'TAKEN_RULE_FOLLOWED',
  rule_broken: 'TAKEN_RULE_BROKEN',
  missed: 'MISSED',
}

export interface AnalysisFilters {
  from?: Date
  to?: Date
  side?: 'LONG' | 'SHORT'
  setupId?: string
  subSetupId?: string
  instrument?: string
  tagId?: string
  quality?: QualityFilter
  // Single-currency scope. Required in practice so totals never blend currencies.
  currency?: string
}

function buildBaseWhere(f: AnalysisFilters): Prisma.TradeWhereInput {
  const where: Prisma.TradeWhereInput = {}
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
  if (f.tagId) {
    where.triggerRules = { some: { triggerRuleId: f.tagId } }
  }
  // Currency scope: the default currency also covers unlinked trades.
  if (f.currency) {
    if (f.currency === DEFAULT_CURRENCY) {
      where.OR = [{ instrumentRef: { is: { currency: f.currency } } }, { instrumentId: null }]
    } else {
      where.instrumentRef = { is: { currency: f.currency } }
    }
  }
  return where
}

export async function getTradesForAnalysis(f: AnalysisFilters): Promise<TradeForStat[]> {
  // Fetch CLOSED (real exits) + MISSED (taken=no, but carry idealExit/executionPnl).
  // The quality axis needs both; the quality FILTER is applied in JS afterwards
  // because it spans status + entryRuleCorrect.
  const where = {
    ...buildBaseWhere(f),
    status: { in: [TradeStatus.CLOSED, TradeStatus.MISSED] },
  }

  const trades = await db.trade.findMany({
    where,
    include: {
      setup: true,
      subSetup: true,
      ruleBreak: true,
      triggerRules: { include: { triggerRule: true } },
      instrumentRef: { select: { currency: true } },
    },
    orderBy: { tradeDate: 'asc' },
  })

  const mapped: TradeForStat[] = trades
    // CLOSED trades without computed pnl/rMultiple are incomplete — skip them
    // (matches the old closed-only filter). MISSED trades keep pnl/rMultiple = 0.
    .filter(t => t.status !== TradeStatus.CLOSED || (t.pnl != null && t.rMultiple != null))
    .map(t => ({
      id: t.id,
      tradeDate: t.tradeDate,
      direction: t.direction as 'LONG' | 'SHORT',
      pnl: t.pnl != null ? Number(t.pnl.toString()) : 0,
      rMultiple: t.rMultiple != null ? Number(t.rMultiple.toString()) : 0,
      instrument: t.instrument,
      currency: t.instrumentRef?.currency ?? DEFAULT_CURRENCY,
      setupName: t.setup.name,
      subSetupName: t.subSetup?.name ?? null,
      tagNames: t.triggerRules.map(tr => tr.triggerRule.name),
      hasRuleBreak: t.ruleBreak !== null,
      ruleBreakPnlImpact: t.ruleBreak ? Number(t.ruleBreak.pnlImpact.toString()) : undefined,
      ruleBreakRImpact: t.ruleBreak ? Number(t.ruleBreak.rMultipleImpact.toString()) : undefined,
      executionPnl: t.executionPnl != null ? Number(t.executionPnl.toString()) : null,
      status: t.status,
      entryRuleCorrect: t.entryRuleCorrect,
    }))

  if (f.quality) {
    const target = QUALITY_FILTER_MAP[f.quality]
    return mapped.filter(t => tradeQuality(t) === target)
  }
  return mapped
}
