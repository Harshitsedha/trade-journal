import { NextRequest } from 'next/server'

export function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1])
}

/** Wrap params as the promise-based route context Next.js App Router expects */
export function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) }
}

/** Minimal valid trade payload */
export function tradeSeed(setupId: string, overrides: Record<string, unknown> = {}) {
  return {
    instrument: 'NIFTY',
    assetClass: 'FUTURES',
    setupId,
    direction: 'LONG',
    entryPrice: '100',
    stopLoss: '95',
    targets: ['110'],
    quantity: '2',
    riskAmount: '1000',
    tradeDate: new Date().toISOString(),
    ...overrides,
  }
}
