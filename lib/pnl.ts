import Decimal from 'decimal.js'
import {
  computePnl as baseComputePnl,
  computeRuleBreakImpact as baseRuleBreakImpact,
} from '@/lib/calculations'
import { computeIdealPnl } from '@/lib/analytics/compute'

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for CURRENCY PnL with the per-instrument factor.
//
// Three currency values are scaled — pnl, executionPnl, pnlImpact — each from
// its OWN unscaled base, with the factor applied ONCE at the very end. The factor
// is NEVER chained: executionPnl is computed from the unscaled actual/ideal here,
// never from an already-scaled stored pnl, so it can't double-apply.
//
// rMultiple and rMultipleImpact are risk-normalized and live in calculations.ts.
// They are NEVER scaled — this module re-exposes rMultipleImpact untouched only
// so the rule-break path has a single call returning both values.
// ─────────────────────────────────────────────────────────────────────────────

type Direction = 'LONG' | 'SHORT'
type DecimalLike = Decimal | string | number

export type FactorOp = 'MULTIPLY' | 'DIVIDE'

/** Minimal shape needed from a linked Instrument. `null`/`undefined` ⇒ no instrument linked. */
export interface InstrumentFactor {
  factor: number | string | Decimal
  factorOp: string // "MULTIPLY" | "DIVIDE"
}

const NEUTRAL = { factor: 1, op: 'MULTIPLY' as FactorOp }

/**
 * Resolve an instrument to a usable `{ factor, op }`. Falls back to the neutral
 * 1 × MULTIPLY (a no-op) when no instrument is linked or the stored factor is
 * non-positive/non-finite. Never throws — an unconfigured trade behaves exactly
 * as it did before this feature.
 */
export function resolveFactor(
  instr: InstrumentFactor | null | undefined,
): { factor: number; op: FactorOp } {
  if (!instr) return NEUTRAL
  const factor = Number(instr.factor)
  if (!Number.isFinite(factor) || factor <= 0) return NEUTRAL
  const op: FactorOp = instr.factorOp === 'DIVIDE' ? 'DIVIDE' : 'MULTIPLY'
  return { factor, op }
}

/** Apply the resolved factor ONCE to a base currency value. */
export function applyFactor(
  base: Decimal,
  instr: InstrumentFactor | null | undefined,
): Decimal {
  const { factor, op } = resolveFactor(instr)
  return op === 'DIVIDE' ? base.div(factor) : base.times(factor)
}

/**
 * Scaled realized PnL.
 *   base = (direction-aware entry→exit) × quantity   (from calculations.computePnl)
 *   pnl  = base × factor
 */
export function computePnl(
  instr: InstrumentFactor | null | undefined,
  args: {
    direction: Direction
    entryPrice: DecimalLike
    exitPrice: DecimalLike
    quantity: DecimalLike
  },
): Decimal {
  const base = baseComputePnl(args.direction, args.entryPrice, args.exitPrice, args.quantity)
  return applyFactor(base, instr)
}

/**
 * Scaled execution PnL = (actualPnl − idealPnl) × factor.
 *
 * Both actualPnl and idealPnl are computed here in UNSCALED price terms, then
 * the factor is applied ONCE to their difference. Factor distributes over the
 * subtraction, so applying it once at the end is identical to scaling each term
 * — we apply once at the end for clarity and to guarantee no double-scaling.
 *
 * Returns 0 when there is no ideal exit (nothing to grade) or no actual exit yet
 * (OPEN trade) — matching the existing unscaled behavior, just scaled.
 */
export function computeExecutionPnl(
  instr: InstrumentFactor | null | undefined,
  args: {
    direction: Direction
    entryPrice: DecimalLike
    idealExit: DecimalLike | null
    quantity: DecimalLike
    /** Resolved actual exit price; null/'' for an OPEN trade with no exit. */
    exitPrice: DecimalLike | null
    /** MISSED/SKIP ⇒ actual pnl is 0 (the move wasn't taken). */
    notTaken?: boolean
  },
): number {
  const idealPnl = computeIdealPnl({
    entryPrice: args.entryPrice,
    idealExit: args.idealExit,
    direction: args.direction,
    quantity: Number(args.quantity),
  })
  if (idealPnl == null) return 0

  // UNSCALED actual pnl base.
  let actualBase: Decimal | null
  if (args.notTaken) {
    actualBase = new Decimal(0)
  } else if (args.exitPrice != null && String(args.exitPrice) !== '') {
    actualBase = baseComputePnl(args.direction, args.entryPrice, args.exitPrice, args.quantity)
  } else {
    actualBase = null // OPEN, no exit yet
  }
  if (actualBase == null) return 0

  const base = actualBase.minus(idealPnl)
  return applyFactor(base, instr).toNumber()
}

/**
 * Rule-break impact. `pnlImpact` (currency) is scaled by the factor; the
 * `rMultipleImpact` (risk-normalized) is returned UNTOUCHED — same value
 * calculations.ts would produce.
 */
export function computeRuleBreakPnlImpact(
  instr: InstrumentFactor | null | undefined,
  params: {
    direction: Direction
    entryPrice: DecimalLike
    stopLoss: DecimalLike
    actualExitPrice: DecimalLike
    ruleExitPrice: DecimalLike
    quantity: DecimalLike
  },
): { pnlImpact: Decimal; rMultipleImpact: Decimal } {
  const base = baseRuleBreakImpact(params)
  return {
    pnlImpact: applyFactor(base.pnlImpact, instr), // scaled currency
    rMultipleImpact: base.rMultipleImpact,         // UNSCALED — never touched
  }
}
