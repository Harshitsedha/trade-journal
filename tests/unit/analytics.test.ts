import { describe, it, expect } from 'vitest'
import {
  computeStat,
  groupBy,
  cleanVsBroken,
  equityCurve,
  tradeQuality,
  groupByQuality,
  QUALITY_LABELS,
  type TradeForStat,
} from '@/lib/analytics/compute'

function makeTrade(overrides: Partial<TradeForStat> & { pnl: number; rMultiple: number }): TradeForStat {
  return {
    id: Math.random().toString(),
    tradeDate: new Date('2024-01-01'),
    direction: 'LONG',
    instrument: 'NIFTY',
    currency: 'INR',
    setupName: 'ORB',
    subSetupName: null,
    tagNames: [],
    hasRuleBreak: false,
    executionPnl: null,
    status: 'CLOSED',
    ...overrides,
  }
}

describe('computeStat', () => {
  it('returns zeros for empty input', () => {
    const s = computeStat([])
    expect(s.trades).toBe(0)
    expect(s.winRate).toBe(0)
    expect(s.expectancyR).toBe(0)
    expect(s.profitFactor).toBe(0)
    // no NaN anywhere (null is allowed for executionPnlSum when no trades)
    for (const v of Object.values(s)) {
      if (v === null) continue
      expect(typeof v).toBe('number')
      expect(isNaN(v as number)).toBe(false)
    }
  })

  it('win rate = wins / (wins+losses), breakeven excluded', () => {
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 1 }),
      makeTrade({ pnl: 200, rMultiple: 2 }),
      makeTrade({ pnl: 0, rMultiple: 0 }),  // breakeven
      makeTrade({ pnl: -50, rMultiple: -0.5 }),
    ]
    const s = computeStat(trades)
    expect(s.wins).toBe(2)
    expect(s.losses).toBe(1)
    expect(s.breakeven).toBe(1)
    expect(s.winRate).toBeCloseTo(2 / 3, 5)
  })

  it('expectancyR = mean rMultiple', () => {
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 1 }),
      makeTrade({ pnl: -50, rMultiple: -0.5 }),
      makeTrade({ pnl: 200, rMultiple: 2 }),
    ]
    const s = computeStat(trades)
    expect(s.expectancyR).toBeCloseTo((1 - 0.5 + 2) / 3, 5)
  })

  it('profitFactor normal case: gross profit / |gross loss|', () => {
    const trades = [
      makeTrade({ pnl: 300, rMultiple: 3 }),
      makeTrade({ pnl: -100, rMultiple: -1 }),
    ]
    const s = computeStat(trades)
    expect(s.profitFactor).toBeCloseTo(3, 5)
  })

  it('profitFactor is Infinity when no losses', () => {
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 1 }),
      makeTrade({ pnl: 200, rMultiple: 2 }),
    ]
    const s = computeStat(trades)
    expect(s.profitFactor).toBe(Infinity)
  })

  it('profitFactor is 0 when only breakeven trades', () => {
    const s = computeStat([makeTrade({ pnl: 0, rMultiple: 0 })])
    expect(s.profitFactor).toBe(0)
  })

  it('avgWinR is positive and avgLossR is negative', () => {
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 2 }),
      makeTrade({ pnl: 200, rMultiple: 3 }),
      makeTrade({ pnl: -50, rMultiple: -1 }),
      makeTrade({ pnl: -100, rMultiple: -2 }),
    ]
    const s = computeStat(trades)
    expect(s.avgWinR).toBeCloseTo(2.5, 5)
    expect(s.avgLossR).toBeCloseTo(-1.5, 5)
    expect(s.avgWinPnl).toBeCloseTo(150, 5)
    expect(s.avgLossPnl).toBeCloseTo(-75, 5)
  })

  it('maxWinStreak and maxLossStreak on known sequence', () => {
    // W W L W W W L L — sorted by date
    const base = new Date('2024-01-01').getTime()
    const trades = [
      makeTrade({ pnl: 10, rMultiple: 1, tradeDate: new Date(base) }),
      makeTrade({ pnl: 10, rMultiple: 1, tradeDate: new Date(base + 1) }),
      makeTrade({ pnl: -10, rMultiple: -1, tradeDate: new Date(base + 2) }),
      makeTrade({ pnl: 10, rMultiple: 1, tradeDate: new Date(base + 3) }),
      makeTrade({ pnl: 10, rMultiple: 1, tradeDate: new Date(base + 4) }),
      makeTrade({ pnl: 10, rMultiple: 1, tradeDate: new Date(base + 5) }),
      makeTrade({ pnl: -10, rMultiple: -1, tradeDate: new Date(base + 6) }),
      makeTrade({ pnl: -10, rMultiple: -1, tradeDate: new Date(base + 7) }),
    ]
    const s = computeStat(trades)
    expect(s.maxWinStreak).toBe(3)
    expect(s.maxLossStreak).toBe(2)
  })

  it('bestR, worstR, bestPnl, worstPnl correct', () => {
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 1 }),
      makeTrade({ pnl: -200, rMultiple: -2 }),
      makeTrade({ pnl: 300, rMultiple: 3 }),
    ]
    const s = computeStat(trades)
    expect(s.bestR).toBe(3)
    expect(s.worstR).toBe(-2)
    expect(s.bestPnl).toBe(300)
    expect(s.worstPnl).toBe(-200)
  })
})

describe('groupBy', () => {
  it('groups by setup correctly', () => {
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 1, setupName: 'ORB' }),
      makeTrade({ pnl: -50, rMultiple: -0.5, setupName: 'ORB' }),
      makeTrade({ pnl: 200, rMultiple: 2, setupName: 'BD' }),
    ]
    const rows = groupBy(trades, 'setup')
    expect(rows).toHaveLength(2)
    const orb = rows.find(r => r.key === 'ORB')!
    expect(orb.stat.trades).toBe(2)
    const bd = rows.find(r => r.key === 'BD')!
    expect(bd.stat.trades).toBe(1)
  })

  it('groups by side (direction)', () => {
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 1, direction: 'LONG' }),
      makeTrade({ pnl: -50, rMultiple: -0.5, direction: 'SHORT' }),
      makeTrade({ pnl: 50, rMultiple: 0.5, direction: 'LONG' }),
    ]
    const rows = groupBy(trades, 'side')
    const long = rows.find(r => r.key === 'LONG')!
    expect(long.stat.trades).toBe(2)
    const short = rows.find(r => r.key === 'SHORT')!
    expect(short.stat.trades).toBe(1)
  })

  it('tag dimension: a trade with 2 tags contributes to both groups', () => {
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 1, tagNames: ['breakout', 'momentum'] }),
      makeTrade({ pnl: -50, rMultiple: -0.5, tagNames: ['breakout'] }),
    ]
    const rows = groupBy(trades, 'tag')
    const bo = rows.find(r => r.key === 'breakout')!
    expect(bo.stat.trades).toBe(2)
    const mom = rows.find(r => r.key === 'momentum')!
    expect(mom.stat.trades).toBe(1)
    // Total count across groups = 3 (double-counted by design)
    const total = rows.reduce((sum, r) => sum + r.stat.trades, 0)
    expect(total).toBe(3)
  })
})

describe('cleanVsBroken', () => {
  it('splits clean and broken correctly', () => {
    const clean1 = makeTrade({ pnl: 100, rMultiple: 1, hasRuleBreak: false })
    const clean2 = makeTrade({ pnl: -50, rMultiple: -0.5, hasRuleBreak: false })
    const broken1 = makeTrade({
      pnl: -80, rMultiple: -0.8, hasRuleBreak: true,
      ruleBreakPnlImpact: -30, ruleBreakRImpact: -0.3,
    })
    const broken2 = makeTrade({
      pnl: 20, rMultiple: 0.2, hasRuleBreak: true,
      ruleBreakPnlImpact: -50, ruleBreakRImpact: -0.5,
    })

    const result = cleanVsBroken([clean1, clean2, broken1, broken2])
    expect(result.clean.trades).toBe(2)
    expect(result.broken.trades).toBe(2)
    expect(result.brokenCostPnl).toBeCloseTo(-80, 5)
    expect(result.brokenCostR).toBeCloseTo(-0.8, 5)
  })
})

describe('tradeQuality', () => {
  it('MISSED status → MISSED regardless of entryRuleCorrect', () => {
    expect(tradeQuality({ status: 'MISSED', entryRuleCorrect: true })).toBe('MISSED')
    expect(tradeQuality({ status: 'MISSED', entryRuleCorrect: false })).toBe('MISSED')
    expect(tradeQuality({ status: 'MISSED', entryRuleCorrect: null })).toBe('MISSED')
  })

  it('taken + entryRuleCorrect=true → TAKEN_RULE_FOLLOWED', () => {
    expect(tradeQuality({ status: 'CLOSED', entryRuleCorrect: true })).toBe('TAKEN_RULE_FOLLOWED')
  })

  it('taken + entryRuleCorrect false/null → TAKEN_RULE_BROKEN', () => {
    expect(tradeQuality({ status: 'CLOSED', entryRuleCorrect: false })).toBe('TAKEN_RULE_BROKEN')
    expect(tradeQuality({ status: 'CLOSED', entryRuleCorrect: null })).toBe('TAKEN_RULE_BROKEN')
    expect(tradeQuality({ status: 'CLOSED' })).toBe('TAKEN_RULE_BROKEN')
  })
})

describe('groupByQuality', () => {
  it('splits into the 3 buckets in fixed order; missed win-rate is N/A', () => {
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 1, status: 'CLOSED', entryRuleCorrect: true }),
      makeTrade({ pnl: -50, rMultiple: -0.5, status: 'CLOSED', entryRuleCorrect: false }),
      makeTrade({ pnl: 0, rMultiple: 0, status: 'MISSED', executionPnl: -300 }),
      makeTrade({ pnl: 0, rMultiple: 0, status: 'MISSED', executionPnl: -120 }),
    ]
    const rows = groupByQuality(trades)
    expect(rows.map(r => r.key)).toEqual([
      QUALITY_LABELS.TAKEN_RULE_FOLLOWED,
      QUALITY_LABELS.TAKEN_RULE_BROKEN,
      QUALITY_LABELS.MISSED,
    ])

    const missed = rows.find(r => r.key === QUALITY_LABELS.MISSED)!
    expect(missed.stat.trades).toBe(2) // count overridden to real misses
    expect(Number.isNaN(missed.stat.winRate)).toBe(true) // N/A, not 0%

    const followed = rows.find(r => r.key === QUALITY_LABELS.TAKEN_RULE_FOLLOWED)!
    expect(followed.stat.trades).toBe(1)
    expect(followed.stat.winRate).toBeCloseTo(1, 5)
  })

  it('drops empty buckets', () => {
    const rows = groupByQuality([
      makeTrade({ pnl: 100, rMultiple: 1, status: 'CLOSED', entryRuleCorrect: true }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe(QUALITY_LABELS.TAKEN_RULE_FOLLOWED)
  })
})

describe('equityCurve', () => {
  it('is monotonic in count and cumulative sum matches totalPnl', () => {
    const base = new Date('2024-01-01').getTime()
    const trades = [
      makeTrade({ pnl: 100, rMultiple: 1, tradeDate: new Date(base) }),
      makeTrade({ pnl: -50, rMultiple: -0.5, tradeDate: new Date(base + 1) }),
      makeTrade({ pnl: 200, rMultiple: 2, tradeDate: new Date(base + 2) }),
    ]
    const curve = equityCurve(trades)
    expect(curve).toHaveLength(3)
    expect(curve[0].cumPnl).toBeCloseTo(100, 5)
    expect(curve[1].cumPnl).toBeCloseTo(50, 5)
    expect(curve[2].cumPnl).toBeCloseTo(250, 5)

    const stat = computeStat(trades)
    expect(curve[curve.length - 1].cumPnl).toBeCloseTo(stat.totalPnl, 5)
  })

  it('returns empty array for empty input', () => {
    expect(equityCurve([])).toEqual([])
  })
})
