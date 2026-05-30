import Decimal from 'decimal.js'

type Direction = 'LONG' | 'SHORT'
type DecimalLike = Decimal | string | number

function d(v: DecimalLike): Decimal {
  return new Decimal(v.toString())
}

export function computeRMultiple(
  direction: Direction,
  entryPrice: DecimalLike,
  stopLoss: DecimalLike,
  exitPrice: DecimalLike
): Decimal {
  const entry = d(entryPrice)
  const stop = d(stopLoss)
  const exit = d(exitPrice)

  const priceDelta = direction === 'LONG' ? exit.minus(entry) : entry.minus(exit)
  const stopDistance = direction === 'LONG' ? entry.minus(stop) : stop.minus(entry)

  return stopDistance.isZero() ? new Decimal(0) : priceDelta.div(stopDistance)
}

export function computePnl(
  direction: Direction,
  entryPrice: DecimalLike,
  exitPrice: DecimalLike,
  quantity: DecimalLike
): Decimal {
  const entry = d(entryPrice)
  const exit = d(exitPrice)
  const qty = d(quantity)

  const priceDelta = direction === 'LONG' ? exit.minus(entry) : entry.minus(exit)
  return priceDelta.times(qty)
}

export function computeRuleBreakImpact(params: {
  direction: Direction
  entryPrice: DecimalLike
  stopLoss: DecimalLike
  actualExitPrice: DecimalLike
  ruleExitPrice: DecimalLike
  quantity: DecimalLike
}): { pnlImpact: Decimal; rMultipleImpact: Decimal } {
  const { direction, entryPrice, stopLoss, actualExitPrice, ruleExitPrice, quantity } = params

  const entry = d(entryPrice)
  const stop = d(stopLoss)
  const actual = d(actualExitPrice)
  const rule = d(ruleExitPrice)
  const qty = d(quantity)

  const stopDistance = direction === 'LONG' ? entry.minus(stop) : stop.minus(entry)

  // Negative when actual was worse than rule (left money on the table)
  // LONG: you should have held higher, so actual - rule is negative
  // SHORT: you should have held lower, so rule - actual is negative
  const priceDelta = direction === 'LONG' ? actual.minus(rule) : rule.minus(actual)

  const pnlImpact = priceDelta.times(qty)
  const rMultipleImpact = stopDistance.isZero() ? new Decimal(0) : priceDelta.div(stopDistance)

  return { pnlImpact, rMultipleImpact }
}
