import { describe, it, expect } from 'vitest'
import {
  resolveFactor,
  computePnl,
  computeExecutionPnl,
  computeRuleBreakPnlImpact,
} from '@/lib/pnl'

// Silver CFD ounce: ×5000. Equity-style: ÷5000 for the DIVIDE checks.
const silverMul = { factor: 5000, factorOp: 'MULTIPLY' }
const silverDiv = { factor: 5000, factorOp: 'DIVIDE' }

describe('resolveFactor — fallbacks never throw', () => {
  it('no instrument → neutral 1 × MULTIPLY', () => {
    expect(resolveFactor(null)).toEqual({ factor: 1, op: 'MULTIPLY' })
    expect(resolveFactor(undefined)).toEqual({ factor: 1, op: 'MULTIPLY' })
  })
  it('non-positive / non-finite factor → neutral (no-op)', () => {
    expect(resolveFactor({ factor: 0, factorOp: 'MULTIPLY' })).toEqual({ factor: 1, op: 'MULTIPLY' })
    expect(resolveFactor({ factor: -5, factorOp: 'MULTIPLY' })).toEqual({ factor: 1, op: 'MULTIPLY' })
    expect(resolveFactor({ factor: NaN, factorOp: 'DIVIDE' })).toEqual({ factor: 1, op: 'MULTIPLY' })
  })
  it('DIVIDE preserved; unknown op coerced to MULTIPLY', () => {
    expect(resolveFactor({ factor: 5000, factorOp: 'DIVIDE' })).toEqual({ factor: 5000, op: 'DIVIDE' })
    expect(resolveFactor({ factor: 2, factorOp: 'wat' })).toEqual({ factor: 2, op: 'MULTIPLY' })
  })
})

describe('computeRuleBreakPnlImpact — factor scales pnlImpact, NOT rMultipleImpact', () => {
  // LONG entry 100, stop 95, actual 108, rule 110, qty 2
  //   priceDelta   = actual - rule = -2
  //   stopDistance = entry - stop  =  5
  //   base pnlImpact       = -2 × 2  = -4
  //   base rMultipleImpact = -2 / 5  = -0.4
  const params = {
    direction: 'LONG' as const,
    entryPrice: '100', stopLoss: '95',
    actualExitPrice: '108', ruleExitPrice: '110',
    quantity: '2',
  }

  it('no instrument → base values (factor 1)', () => {
    const r = computeRuleBreakPnlImpact(null, params)
    expect(r.pnlImpact.toNumber()).toBe(-4)
    expect(r.rMultipleImpact.toNumber()).toBeCloseTo(-0.4, 10)
  })

  it('MULTIPLY ×5000 → pnlImpact base × 5000; rMultipleImpact UNCHANGED', () => {
    const r = computeRuleBreakPnlImpact(silverMul, params)
    expect(r.pnlImpact.toNumber()).toBe(-4 * 5000) // -20000
    expect(r.rMultipleImpact.toNumber()).toBeCloseTo(-0.4, 10) // unscaled
  })

  it('DIVIDE ÷5000 → pnlImpact base / 5000; rMultipleImpact UNCHANGED', () => {
    const r = computeRuleBreakPnlImpact(silverDiv, params)
    expect(r.pnlImpact.toNumber()).toBeCloseTo(-4 / 5000, 12) // -0.0008
    expect(r.rMultipleImpact.toNumber()).toBeCloseTo(-0.4, 10) // unscaled
  })

  it('rMultipleImpact is identical across factor=1, MULTIPLY and DIVIDE', () => {
    const base = computeRuleBreakPnlImpact(null, params).rMultipleImpact.toNumber()
    const mul = computeRuleBreakPnlImpact(silverMul, params).rMultipleImpact.toNumber()
    const div = computeRuleBreakPnlImpact(silverDiv, params).rMultipleImpact.toNumber()
    expect(mul).toBe(base)
    expect(div).toBe(base)
  })
})

describe('computePnl — factor applied once at the end', () => {
  // LONG entry 100, exit 110, qty 2 → base = 10 × 2 = 20
  const args = { direction: 'LONG' as const, entryPrice: '100', exitPrice: '110', quantity: '2' }
  it('no instrument → base 20', () => {
    expect(computePnl(null, args).toNumber()).toBe(20)
  })
  it('MULTIPLY ×5000 → 100000', () => {
    expect(computePnl(silverMul, args).toNumber()).toBe(20 * 5000)
  })
  it('DIVIDE ÷5000 → 0.004', () => {
    expect(computePnl(silverDiv, args).toNumber()).toBeCloseTo(20 / 5000, 12)
  })
})

describe('computeExecutionPnl — (actual − ideal) × factor, from UNSCALED base', () => {
  // LONG entry 100, exit 108, idealExit 110, qty 2
  //   actualBase = (108-100) × 2 = 16 ; idealPnl = (110-100) × 2 = 20 ; base = -4
  const args = {
    direction: 'LONG' as const, entryPrice: '100',
    idealExit: '110', quantity: '2', exitPrice: '108',
  }
  it('no instrument → base -4', () => {
    expect(computeExecutionPnl(null, args)).toBe(-4)
  })
  it('MULTIPLY ×5000 → -20000', () => {
    expect(computeExecutionPnl(silverMul, args)).toBe(-4 * 5000)
  })
  it('DIVIDE ÷5000 → -0.0008', () => {
    expect(computeExecutionPnl(silverDiv, args)).toBeCloseTo(-4 / 5000, 12)
  })
  it('no idealExit → 0 (nothing to grade), regardless of factor', () => {
    expect(computeExecutionPnl(silverMul, { ...args, idealExit: null })).toBe(0)
  })
  it('OPEN (no exit, not taken=false) → 0', () => {
    expect(computeExecutionPnl(silverMul, { ...args, exitPrice: null })).toBe(0)
  })
  it('not taken (MISSED/SKIP) → (0 − ideal) × factor = -100000', () => {
    expect(computeExecutionPnl(silverMul, { ...args, exitPrice: null, notTaken: true })).toBe(-20 * 5000)
  })
})
