import { describe, it, expect } from 'vitest'
import {
  computeSideCorrect,
  computeIdealPnl,
  computeExecutionPnl,
  computeStat,
} from '@/lib/analytics/compute'
import type { TradeForStat } from '@/lib/analytics/compute'

// ── computeSideCorrect ────────────────────────────────────────────────────────

describe('computeSideCorrect', () => {
  it('returns true when directions match (LONG)', () => {
    expect(computeSideCorrect('LONG', 'LONG')).toBe(true)
  })

  it('returns true when directions match (SHORT)', () => {
    expect(computeSideCorrect('SHORT', 'SHORT')).toBe(true)
  })

  it('returns false when directions mismatch', () => {
    expect(computeSideCorrect('LONG', 'SHORT')).toBe(false)
    expect(computeSideCorrect('SHORT', 'LONG')).toBe(false)
  })

  it('returns null when idealDirection is null', () => {
    expect(computeSideCorrect('LONG', null)).toBeNull()
  })

  it('returns null when idealDirection is undefined', () => {
    expect(computeSideCorrect('SHORT', undefined)).toBeNull()
  })
})

// ── computeIdealPnl ───────────────────────────────────────────────────────────

describe('computeIdealPnl', () => {
  it('computes positive pnl for a winning LONG trade', () => {
    // entry 100, exit 110, qty 10 → (110-100)*10 = 100
    const result = computeIdealPnl({
      idealEntry: '100',
      idealExit: '110',
      idealDirection: 'LONG',
      quantity: '10',
    })
    expect(result).toBe(100)
  })

  it('computes negative pnl for a losing LONG trade', () => {
    // entry 100, exit 90, qty 10 → (90-100)*10 = -100
    const result = computeIdealPnl({
      idealEntry: '100',
      idealExit: '90',
      idealDirection: 'LONG',
      quantity: '10',
    })
    expect(result).toBe(-100)
  })

  it('computes positive pnl for a winning SHORT trade', () => {
    // entry 100, exit 90, qty 10 → (100-90)*10 = 100
    const result = computeIdealPnl({
      idealEntry: '100',
      idealExit: '90',
      idealDirection: 'SHORT',
      quantity: '10',
    })
    expect(result).toBe(100)
  })

  it('computes negative pnl for a losing SHORT trade', () => {
    // entry 100, exit 110, qty 10 → (100-110)*10 = -100
    const result = computeIdealPnl({
      idealEntry: '100',
      idealExit: '110',
      idealDirection: 'SHORT',
      quantity: '10',
    })
    expect(result).toBe(-100)
  })

  it('returns null when idealEntry is missing', () => {
    expect(
      computeIdealPnl({ idealExit: '110', idealDirection: 'LONG', quantity: '10' })
    ).toBeNull()
  })

  it('returns null when idealExit is missing', () => {
    expect(
      computeIdealPnl({ idealEntry: '100', idealDirection: 'LONG', quantity: '10' })
    ).toBeNull()
  })

  it('returns null when idealDirection is missing', () => {
    expect(
      computeIdealPnl({ idealEntry: '100', idealExit: '110', quantity: '10' })
    ).toBeNull()
  })

  it('handles Decimal-like objects with toString()', () => {
    const decLike = { toString: () => '50' }
    const result = computeIdealPnl({
      idealEntry: decLike,
      idealExit: { toString: () => '60' },
      idealDirection: 'LONG',
      quantity: { toString: () => '5' },
    })
    expect(result).toBe(50)
  })
})

// ── computeExecutionPnl ───────────────────────────────────────────────────────

describe('computeExecutionPnl', () => {
  it('returns positive value when actual > ideal (better execution)', () => {
    // ideal: 100, actual: 120 → 120 - 100 = 20
    expect(computeExecutionPnl(120, 100)).toBe(20)
  })

  it('returns negative value when actual < ideal (worse execution)', () => {
    // ideal: 100, actual: 80 → 80 - 100 = -20
    expect(computeExecutionPnl(80, 100)).toBe(-20)
  })

  it('returns negative for MISSED trade (actualPnl=0, positive idealPnl)', () => {
    // missed a 500 profit trade → 0 - 500 = -500
    expect(computeExecutionPnl(0, 500)).toBe(-500)
  })

  it('returns null when idealPnl is null', () => {
    expect(computeExecutionPnl(100, null)).toBeNull()
  })

  it('returns zero when actual equals ideal', () => {
    expect(computeExecutionPnl(100, 100)).toBe(0)
  })
})

// ── computeStat executionPnlSum ───────────────────────────────────────────────

function makeTrade(overrides: Partial<TradeForStat>): TradeForStat {
  return {
    id: 'trade-1',
    tradeDate: new Date('2025-01-01'),
    direction: 'LONG',
    pnl: 1000,
    rMultiple: 2,
    instrument: 'NIFTY',
    setupName: 'Breakout',
    subSetupName: null,
    tagNames: [],
    hasRuleBreak: false,
    executionPnl: null,
    status: 'CLOSED',
    ...overrides,
  }
}

describe('computeStat executionPnlSum', () => {
  it('is null when all trades have null executionPnl', () => {
    const trades = [makeTrade({ executionPnl: null }), makeTrade({ id: '2', executionPnl: null })]
    expect(computeStat(trades).executionPnlSum).toBeNull()
  })

  it('sums non-null executionPnl values and skips nulls', () => {
    const trades = [
      makeTrade({ id: '1', executionPnl: 200 }),
      makeTrade({ id: '2', executionPnl: null }),
      makeTrade({ id: '3', executionPnl: -50 }),
    ]
    expect(computeStat(trades).executionPnlSum).toBe(150)
  })

  it('includes MISSED trades in executionPnlSum but excludes them from pnl stats', () => {
    const trades = [
      makeTrade({ id: '1', pnl: 1000, rMultiple: 2, executionPnl: 100, status: 'CLOSED' }),
      makeTrade({ id: '2', pnl: 0, rMultiple: 0, executionPnl: -500, status: 'MISSED' }),
    ]
    const stat = computeStat(trades)
    expect(stat.executionPnlSum).toBe(-400)
    // MISSED trade should not count in trade count for pnl stats
    expect(stat.trades).toBe(1)
    expect(stat.totalPnl).toBe(1000)
  })
})
