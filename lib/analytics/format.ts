// Currency symbol is passed in (mixed-currency app); defaults to ₹ for callers
// that haven't been threaded yet.

// Coerce anything numeric-ish (number, null, undefined, or a Prisma Decimal whose
// toString() yields a number) into a finite number. Guarantees the display layer
// never calls .toFixed / arithmetic on null — the source of the analysis crash.
function num(value: unknown): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function fmtPnl(value: number, sym = '₹'): string {
  const v = num(value)
  const abs = Math.abs(v).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })
  if (v >= 0) return `+${sym}${abs}`
  return `−${sym}${abs}` // unicode minus
}

export function fmtPnlPlain(value: number, sym = '₹'): string {
  const v = num(value)
  const abs = Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  if (v >= 0) return `${sym}${abs}`
  return `−${sym}${abs}`
}

export function fmtR(value: number): string {
  const v = num(value)
  const sign = v >= 0 ? '+' : '−'
  return `${sign}${Math.abs(v).toFixed(2)}R`
}

export function fmtPct(value: number): string {
  // NaN is meaningful here (e.g. the Missed quality bucket) → keep N/A.
  if (Number.isNaN(value)) return 'N/A'
  return `${(num(value) * 100).toFixed(1)}%`
}

export function fmtNum(value: number, decimals = 2): string {
  return num(value).toFixed(decimals)
}
