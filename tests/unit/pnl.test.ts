import { describe, it, expect } from 'vitest'
import {
  resolveFactor,
  resolvePnlOverride,
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

// ── Manual PnL override (implied-factor) ─────────────────────────────────────
describe('pnlOverride — implied factor (DAX example)', () => {
  // LONG entry 18000, exit 17985.42, qty 1 → base = -14.58
  // override = -16.97 → impliedFactor = -16.97 / -14.58 ≈ 1.16392
  const dax = { factor: 1, factorOp: 'MULTIPLY' }
  const base = -14.58
  const override = -16.97
  const implied = override / base // 1.16392...
  const trade = {
    direction: 'LONG' as const, entryPrice: '18000', exitPrice: '17985.42',
    stopLoss: '17970', quantity: '1', idealExit: '18010', // idealBase = 10
  }

  it('implied factor is ~1.164', () => {
    expect(implied).toBeCloseTo(1.164, 3)
  })

  it('stored pnl = the override value, used directly', () => {
    expect(computePnl(dax, { ...trade }, override).toNumber()).toBe(override)
  })

  it('executionPnl = override − (idealBase × implied)', () => {
    const exec = computeExecutionPnl(dax, {
      direction: trade.direction, entryPrice: trade.entryPrice,
      idealExit: trade.idealExit, quantity: trade.quantity, exitPrice: trade.exitPrice,
    }, override)
    expect(exec).toBeCloseTo(override - 10 * implied, 6) // ≈ -28.609
  })

  it('pnlImpact scales by the implied factor; rMultipleImpact does NOT', () => {
    // rule break: actual 17985.42, rule 17990 → impactBase = -4.58
    const rbParams = {
      direction: trade.direction, entryPrice: trade.entryPrice, stopLoss: trade.stopLoss,
      actualExitPrice: '17985.42', ruleExitPrice: '17990', quantity: trade.quantity,
    }
    const withOverride = computeRuleBreakPnlImpact(dax, rbParams, override, trade.exitPrice)
    const noOverride = computeRuleBreakPnlImpact(dax, rbParams) // factor 1
    expect(withOverride.pnlImpact.toNumber()).toBeCloseTo(-4.58 * implied, 6) // ≈ -5.331
    // rMultipleImpact identical with or without the override
    expect(withOverride.rMultipleImpact.toNumber()).toBeCloseTo(noOverride.rMultipleImpact.toNumber(), 12)
    expect(withOverride.rMultipleImpact.toNumber()).toBeCloseTo(-4.58 / 30, 10) // -0.1527, unscaled
  })
})

describe('pnlOverride — base==0 fallback (no div-by-zero)', () => {
  // entry == exit → base = priceDelta × qty = 0
  const silver = { factor: 5000, factorOp: 'MULTIPLY' }
  const trade = {
    direction: 'LONG' as const, entryPrice: '100', exitPrice: '100',
    quantity: '2', idealExit: '110', // idealBase = 20
  }
  it('pnl = override even when base is 0', () => {
    expect(computePnl(silver, { ...trade }, 50).toNumber()).toBe(50)
  })
  it('executionPnl falls back to the INSTRUMENT factor for ideal — finite, no NaN/Infinity', () => {
    const exec = computeExecutionPnl(silver, {
      direction: trade.direction, entryPrice: trade.entryPrice,
      idealExit: trade.idealExit, quantity: trade.quantity, exitPrice: trade.exitPrice,
    }, 50)
    expect(Number.isFinite(exec)).toBe(true)
    // 50 (override) − (idealBase 20 × instrument 5000) = 50 − 100000
    expect(exec).toBe(50 - 20 * 5000)
  })
})

describe('resolvePnlOverride — stickiness across a PATCH', () => {
  it('undefined (field absent) keeps the existing value', () => {
    expect(resolvePnlOverride(undefined, -16.97)).toBe(-16.97)
    expect(resolvePnlOverride(undefined, null)).toBe(null)
  })
  it('null clears to calculated; a number sets it', () => {
    expect(resolvePnlOverride(null, -16.97)).toBe(null)
    expect(resolvePnlOverride(-5, -16.97)).toBe(-5)
  })
})

describe('pnlOverride NULL → unchanged instrument-factor behavior (Silver ×5000 regression)', () => {
  const silver = { factor: 5000, factorOp: 'MULTIPLY' }
  const args = { direction: 'LONG' as const, entryPrice: '100', exitPrice: '110', quantity: '2' }
  it('computePnl with override null/undefined == no-override instrument path', () => {
    const noArg = computePnl(silver, args).toNumber()
    expect(computePnl(silver, args, null).toNumber()).toBe(noArg)
    expect(computePnl(silver, args, undefined).toNumber()).toBe(noArg)
    expect(noArg).toBe(20 * 5000) // 100000, instrument factor intact
  })
  it('computeExecutionPnl with override null == no-override instrument path', () => {
    const exArgs = { ...args, idealExit: '112' as string | null, exitPrice: '110' as string | null }
    const noArg = computeExecutionPnl(silver, exArgs)
    expect(computeExecutionPnl(silver, exArgs, null)).toBe(noArg)
  })
})
