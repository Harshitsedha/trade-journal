import { describe, it, expect } from 'vitest'
import { computeRMultiple, computePnl, computeRuleBreakImpact } from '@/lib/calculations'

describe('computeRMultiple — LONG', () => {
  it('entry 100, stop 95, exit 110 → +2.0R', () => {
    const r = computeRMultiple('LONG', '100', '95', '110')
    expect(r.toNumber()).toBe(2.0)
  })

  it('entry 100, stop 95, exit 97 → -0.6R', () => {
    const r = computeRMultiple('LONG', '100', '95', '97')
    expect(r.toNumber()).toBeCloseTo(-0.6, 10)
  })

  it('entry 100, stop 95, exit 95 → -1.0R (full stop)', () => {
    const r = computeRMultiple('LONG', '100', '95', '95')
    expect(r.toNumber()).toBe(-1.0)
  })
})

describe('computeRMultiple — SHORT', () => {
  it('entry 100, stop 105, exit 90 → +2.0R', () => {
    const r = computeRMultiple('SHORT', '100', '105', '90')
    expect(r.toNumber()).toBe(2.0)
  })

  it('entry 100, stop 105, exit 103 → -0.6R', () => {
    const r = computeRMultiple('SHORT', '100', '105', '103')
    expect(r.toNumber()).toBeCloseTo(-0.6, 10)
  })

  it('entry 100, stop 105, exit 105 → -1.0R (full stop)', () => {
    const r = computeRMultiple('SHORT', '100', '105', '105')
    expect(r.toNumber()).toBe(-1.0)
  })
})

describe('computePnl', () => {
  it('LONG profit', () => {
    const pnl = computePnl('LONG', '100', '110', '2')
    expect(pnl.toNumber()).toBe(20)
  })

  it('SHORT profit', () => {
    const pnl = computePnl('SHORT', '100', '90', '2')
    expect(pnl.toNumber()).toBe(20)
  })

  it('LONG loss', () => {
    const pnl = computePnl('LONG', '100', '95', '2')
    expect(pnl.toNumber()).toBe(-10)
  })
})

describe('computeRuleBreakImpact', () => {
  it('LONG early exit: actual 110, rule 115, qty 2 → pnlImpact -10', () => {
    const { pnlImpact, rMultipleImpact } = computeRuleBreakImpact({
      direction: 'LONG',
      entryPrice: '100',
      stopLoss: '95',
      actualExitPrice: '110',
      ruleExitPrice: '115',
      quantity: '2',
    })
    expect(pnlImpact.toNumber()).toBe(-10)
    // stopDistance=5, priceDelta=110-115=-5 → rMultipleImpact=-1R
    expect(rMultipleImpact.toNumber()).toBe(-1)
  })

  it('SHORT early exit: actual 90, rule 85, qty 2 → pnlImpact -10', () => {
    const { pnlImpact, rMultipleImpact } = computeRuleBreakImpact({
      direction: 'SHORT',
      entryPrice: '100',
      stopLoss: '105',
      actualExitPrice: '90',
      ruleExitPrice: '85',
      quantity: '2',
    })
    expect(pnlImpact.toNumber()).toBe(-10)
    expect(rMultipleImpact.toNumber()).toBe(-1)
  })

  it('LONG over-held: actual 115, rule 110, qty 2 → pnlImpact +10 (exceeded rule)', () => {
    const { pnlImpact } = computeRuleBreakImpact({
      direction: 'LONG',
      entryPrice: '100',
      stopLoss: '95',
      actualExitPrice: '115',
      ruleExitPrice: '110',
      quantity: '2',
    })
    expect(pnlImpact.toNumber()).toBe(10)
  })
})
