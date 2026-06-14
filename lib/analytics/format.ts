// Currency symbol is passed in (mixed-currency app); defaults to ₹ for callers
// that haven't been threaded yet.
export function fmtPnl(value: number, sym = '₹'): string {
  const abs = Math.abs(value).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })
  if (value >= 0) return `+${sym}${abs}`
  return `−${sym}${abs}` // unicode minus
}

export function fmtPnlPlain(value: number, sym = '₹'): string {
  const abs = Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  if (value >= 0) return `${sym}${abs}`
  return `−${sym}${abs}`
}

export function fmtR(value: number): string {
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(2)}R`
}

export function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function fmtNum(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}
