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

  it('returns null when primaryRuleDirection is null', () => {
    expect(computeSideCorrect('LONG', null)).toBeNull()
  })

  it('returns null when primaryRuleDirection is undefined', () => {
    expect(computeSideCorrect('SHORT', undefined)).toBeNull()
  })

  it('returns null when primaryRuleDirection is BOTH', () => {
    expect(computeSideCorrect('LONG', 'BOTH')).toBeNull()
    expect(computeSideCorrect('SHORT', 'BOTH')).toBeNull()
  })
})

// ── computeIdealPnl ───────────────────────────────────────────────────────────

describe('computeIdealPnl', () => {
  it('computes positive pnl for a winning LONG trade', () => {
    // entry 100, idealExit 110, qty 10 → (110-100)*10 = 100
    const result = computeIdealPnl({
      entryPrice: '100',
      idealExit: '110',
      direction: 'LONG',
      quantity: 10,
    })
    expect(result).toBe(100)
  })

  it('computes negative pnl for a losing LONG trade', () => {
    // entry 100, idealExit 90, qty 10 → (90-100)*10 = -100
    const result = computeIdealPnl({
      entryPrice: '100',
      idealExit: '90',
      direction: 'LONG',
      quantity: 10,
    })
    expect(result).toBe(-100)
  })

  it('computes positive pnl for a winning SHORT trade', () => {
    // entry 100, idealExit 90, qty 10 → (100-90)*10 = 100
    const result = computeIdealPnl({
      entryPrice: '100',
      idealExit: '90',
      direction: 'SHORT',
      quantity: 10,
    })
    expect(result).toBe(100)
  })

  it('computes negative pnl for a losing SHORT trade', () => {
    // entry 100, idealExit 110, qty 10 → (100-110)*10 = -100
    const result = computeIdealPnl({
      entryPrice: '100',
      idealExit: '110',
      direction: 'SHORT',
      quantity: 10,
    })
    expect(result).toBe(-100)
  })

  it('returns null when entryPrice is missing', () => {
    expect(
      computeIdealPnl({ idealExit: '110', direction: 'LONG', quantity: 10 })
    ).toBeNull()
  })

  it('returns null when idealExit is missing', () => {
    expect(
      computeIdealPnl({ entryPrice: '100', direction: 'LONG', quantity: 10 })
    ).toBeNull()
  })

  it('returns null when direction is missing', () => {
    expect(
      computeIdealPnl({ entryPrice: '100', idealExit: '110', quantity: 10 })
    ).toBeNull()
  })

  it('handles Decimal-like objects with toString()', () => {
    const result = computeIdealPnl({
      entryPrice: { toString: () => '50' },
      idealExit: { toString: () => '60' },
      direction: 'LONG',
      quantity: 5,
    })
    expect(result).toBe(50)
  })

  it('returns 0 (not null) when idealExit equals entryPrice — breakeven ideal', () => {
    // BE ideal is a real, valid result of 0 — must be distinct from "no ideal set" (null)
    expect(
      computeIdealPnl({ entryPrice: '1234', idealExit: '1234', direction: 'LONG', quantity: 75 })
    ).toBe(0)
    // Decimal-string equivalence ("1234.0" vs "1234") must still resolve to 0, not null
    expect(
      computeIdealPnl({ entryPrice: '1234', idealExit: '1234.0', direction: 'SHORT', quantity: 75 })
    ).toBe(0)
  })
})

// ── computeExecutionPnl ───────────────────────────────────────────────────────

describe('computeExecutionPnl', () => {
  it('returns positive value when actual > ideal (better execution)', () => {
    expect(computeExecutionPnl(120, 100)).toBe(20)
  })

  it('returns negative value when actual < ideal (worse execution)', () => {
    expect(computeExecutionPnl(80, 100)).toBe(-20)
  })

  it('MISSED winning trade: executionPnl is negative (you missed gains)', () => {
    // entry 100, idealExit 125, LONG, qty 1 → idealPnl +25 → executionPnl = 0 - 25 = -25
    const idealPnl = computeIdealPnl({ entryPrice: '100', idealExit: '125', direction: 'LONG', quantity: 1 })
    expect(idealPnl).toBe(25)
    expect(computeExecutionPnl(0, idealPnl)).toBe(-25)
  })

  it('MISSED losing trade: executionPnl is positive (missing it saved you)', () => {
    // entry 100, idealExit 90, LONG, qty 1 → idealPnl -10 → executionPnl = 0 - (-10) = +10
    const idealPnl = computeIdealPnl({ entryPrice: '100', idealExit: '90', direction: 'LONG', quantity: 1 })
    expect(idealPnl).toBe(-10)
    expect(computeExecutionPnl(0, idealPnl)).toBe(10)
  })

  it('returns 0 when idealPnl is null (no idealExit set)', () => {
    expect(computeExecutionPnl(100, null)).toBe(0)
  })

  it('returns zero when actual equals ideal', () => {
    expect(computeExecutionPnl(100, 100)).toBe(0)
  })

  it('BE ideal + losing actual: executionPnl is the full loss, NOT 0', () => {
    // Regression: idealExit=BE -> idealPnl=0 (valid), actual exit -1R (e.g. -100).
    // The 0 guard must trigger on null only, never on a falsy 0 idealPnl.
    const idealPnl = computeIdealPnl({ entryPrice: '1234', idealExit: '1234', direction: 'LONG', quantity: 100 })
    expect(idealPnl).toBe(0)
    expect(computeExecutionPnl(-100, idealPnl)).toBe(-100)
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

  it('treats SKIP like MISSED: in executionPnlSum, excluded from pnl stats', () => {
    const trades = [
      makeTrade({ id: '1', pnl: 1000, rMultiple: 2, executionPnl: 100, status: 'CLOSED' }),
      makeTrade({ id: '2', pnl: 0, rMultiple: 0, executionPnl: -300, status: 'SKIP' }),
    ]
    const stat = computeStat(trades)
    expect(stat.executionPnlSum).toBe(-200)
    expect(stat.trades).toBe(1)
    expect(stat.totalPnl).toBe(1000)
  })
})
