// Currency is carried by the Instrument. A trade's currency is its linked
// instrument's currency; an unlinked trade falls back to the app default (INR).
// We never blend currencies in a total — see dashboard/analytics per-currency split.

export const CURRENCIES = ['USD', 'INR'] as const
export type CurrencyCode = (typeof CURRENCIES)[number]

export const DEFAULT_CURRENCY: CurrencyCode = 'INR' // app default for unlinked trades

const SYMBOLS: Record<string, string> = {
  USD: '$',
  INR: '₹',
}

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v)
}

/** Symbol for a currency code; falls back to the code itself for unknowns. */
export function currencySymbol(code: string | null | undefined): string {
  if (!code) return SYMBOLS[DEFAULT_CURRENCY]
  return SYMBOLS[code] ?? code + ' '
}

/** A trade's currency code from its linked instrument, else the app default. */
export function tradeCurrency(
  trade: { instrumentRef?: { currency?: string | null } | null } | null | undefined,
): CurrencyCode {
  const c = trade?.instrumentRef?.currency
  return isCurrencyCode(c) ? c : DEFAULT_CURRENCY
}
