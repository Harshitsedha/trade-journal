import Decimal from 'decimal.js'
import {
  computePnl as baseComputePnl,
  computeRuleBreakImpact as baseRuleBreakImpact,
} from '@/lib/calculations'
import { computeIdealPnl } from '@/lib/analytics/compute'

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for CURRENCY PnL.
//
// Two scaling modes, resolved per trade:
//   • instrument-factor: pnlOverride is null → scale by the linked Instrument's
//     factor (or 1 when unlinked). This is the original behaviour.
//   • implied-factor: pnlOverride is set (a hand-entered actual USD pnl) →
//       base          = unscaled calculated pnl = priceDelta × qty
//       impliedFactor = pnlOverride / base
//       stored pnl    = pnlOverride (used directly)
//       idealPnl, pnlImpact = their unscaled base × impliedFactor
//       executionPnl  = pnl − idealPnl  (now in the same USD units)
//     Edge: base == 0 (priceDelta 0 or qty 0) → impliedFactor undefined; fall
//     back to the instrument factor for idealPnl/pnlImpact, pnl = pnlOverride.
//
// rMultiple and rMultipleImpact are risk-normalized and NEVER scaled by either
// mode — they live in calculations.ts and are returned untouched.
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

/** Resolve an instrument to a usable `{ factor, op }`; neutral fallback, never throws. */
export function resolveFactor(
  instr: InstrumentFactor | null | undefined,
): { factor: number; op: FactorOp } {
  if (!instr) return NEUTRAL
  const factor = Number(instr.factor)
  if (!Number.isFinite(factor) || factor <= 0) return NEUTRAL
  const op: FactorOp = instr.factorOp === 'DIVIDE' ? 'DIVIDE' : 'MULTIPLY'
  return { factor, op }
}

function applyResolved(base: Decimal, f: { factor: number; op: FactorOp }): Decimal {
  return f.op === 'DIVIDE' ? base.div(f.factor) : base.times(f.factor)
}

/** Apply the resolved instrument factor ONCE to a base currency value. */
export function applyFactor(base: Decimal, instr: InstrumentFactor | null | undefined): Decimal {
  return applyResolved(base, resolveFactor(instr))
}

/**
 * The effective `{ factor, op }` used to scale idealPnl / pnlImpact.
 *   • pnlOverride set & base ≠ 0 → implied factor = pnlOverride / base (MULTIPLY)
 *   • pnlOverride set & base == 0 → instrument factor (div-by-zero fallback)
 *   • pnlOverride null           → instrument factor
 */
export function effectiveFactor(
  instr: InstrumentFactor | null | undefined,
  base: DecimalLike,
  pnlOverride: number | null | undefined,
): { factor: number; op: FactorOp } {
  if (pnlOverride != null) {
    const b = new Decimal(base.toString())
    if (!b.isZero()) {
      return { factor: new Decimal(pnlOverride).div(b).toNumber(), op: 'MULTIPLY' }
    }
  }
  return resolveFactor(instr)
}

/**
 * Stickiness resolver for pnlOverride across an edit.
 *   undefined (field absent from the request) → keep the existing value
 *   null (explicit clear)                      → null
 *   number                                     → that number
 */
export function resolvePnlOverride(
  incoming: number | null | undefined,
  existing: number | null,
): number | null {
  if (incoming === undefined) return existing ?? null
  return incoming ?? null
}

/**
 * Stored realized PnL.
 *   override set → the override value, used directly.
 *   override null → base × instrument factor.
 */
export function computePnl(
  instr: InstrumentFactor | null | undefined,
  args: {
    direction: Direction
    entryPrice: DecimalLike
    exitPrice: DecimalLike
    quantity: DecimalLike
  },
  pnlOverride?: number | null,
): Decimal {
  if (pnlOverride != null) return new Decimal(pnlOverride)
  return applyFactor(baseComputePnl(args.direction, args.entryPrice, args.exitPrice, args.quantity), instr)
}

/**
 * Stored execution PnL = stored pnl − scaled idealPnl, both in the same units.
 * The scaler is the implied factor (override) or the instrument factor.
 * 0 when there is no ideal exit or no actual exit yet.
 */
export function computeExecutionPnl(
  instr: InstrumentFactor | null | undefined,
  args: {
    direction: Direction
    entryPrice: DecimalLike
    idealExit: DecimalLike | null
    quantity: DecimalLike
    exitPrice: DecimalLike | null
    notTaken?: boolean
  },
  pnlOverride?: number | null,
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

  const eff = effectiveFactor(instr, actualBase, pnlOverride)
  const storedPnl = pnlOverride != null ? new Decimal(pnlOverride) : applyResolved(actualBase, eff)
  const scaledIdeal = applyResolved(new Decimal(idealPnl), eff)
  return storedPnl.minus(scaledIdeal).toNumber()
}

/**
 * Rule-break impact. `pnlImpact` is scaled by the effective factor (implied when
 * an override is present, else the instrument factor); `rMultipleImpact` is
 * returned UNSCALED. When an override is in play the implied factor is derived
 * from the TRADE's pnl base (priceDelta × qty at `tradeExitPrice`), so pnlImpact
 * scales identically to pnl/executionPnl.
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
  pnlOverride?: number | null,
  tradeExitPrice?: DecimalLike | null,
): { pnlImpact: Decimal; rMultipleImpact: Decimal } {
  const base = baseRuleBreakImpact(params)
  let eff: { factor: number; op: FactorOp }
  if (pnlOverride != null && tradeExitPrice != null && String(tradeExitPrice) !== '') {
    const tradeBase = baseComputePnl(params.direction, params.entryPrice, tradeExitPrice, params.quantity)
    eff = effectiveFactor(instr, tradeBase, pnlOverride)
  } else {
    eff = resolveFactor(instr)
  }
  return {
    pnlImpact: applyResolved(base.pnlImpact, eff),
    rMultipleImpact: base.rMultipleImpact, // UNSCALED — never touched
  }
}
