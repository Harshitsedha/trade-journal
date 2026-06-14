/**
 * Backfill: link existing trades to Instrument rows and recompute currency PnL
 * through the per-instrument factor (lib/pnl.ts), from RAW price legs — never by
 * scaling a stored rounded value. rMultiple / rMultipleImpact are NEVER touched.
 *
 * Modes:
 *   DRY-RUN (default): prints the per-trade diff, writes NOTHING.
 *   WRITE (BACKFILL_WRITE=1): creates Instrument rows, links trades, and persists
 *     pnl/executionPnl/pnlImpact in ONE transaction (rollback on any error).
 *
 * Targets / gates:
 *   test branch (ep-tiny-sound): dry-run or write, no extra opt-in.
 *   prod (ep-noisy-brook):  dry-run  → ALLOW_PROD_DRYRUN=1
 *                           write    → BACKFILL_WRITE=1 AND ALLOW_PROD_WRITE=1
 *
 * Examples:
 *   ALLOW_PROD_DRYRUN=1 DATABASE_URL=<prod> npx tsx scripts/backfill-instrument-factor.ts
 *   BACKFILL_WRITE=1 ALLOW_PROD_WRITE=1 DATABASE_URL=<prod> npx tsx scripts/backfill-instrument-factor.ts
 */
import { PrismaClient } from '../generated/prisma/client/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import Decimal from 'decimal.js'
import {
  computePnl,
  computeExecutionPnl,
  computeRuleBreakPnlImpact,
  type InstrumentFactor,
} from '@/lib/pnl'
import { computeRMultiple } from '@/lib/calculations'

neonConfig.webSocketConstructor = ws

// SILVER CFD ounce ×5000; DAX40 uses per-trade pnlOverride (manual USD), NOT
// auto-scaling → factor 1 (no-op).
const CONFIG: Record<string, InstrumentFactor & { name: string; currency: string }> = {
  SILVER: { factor: 5000, factorOp: 'MULTIPLY', currency: 'USD', name: 'Silver CFD (oz)' },
  DAX40: { factor: 1, factorOp: 'MULTIPLY', currency: 'USD', name: 'DAX40 CFD' },
}

const DRY_RUN = process.env.BACKFILL_WRITE !== '1'

type TradeRow = {
  id: string; instrument: string; status: string
  direction: string
  entryPrice: Decimal; stopLoss: Decimal; quantity: Decimal
  exitPrice: Decimal | null; idealExit: Decimal | null
  pnl: Decimal | null; executionPnl: Decimal | null; rMultiple: Decimal | null
  pnlOverride: number | null
  ruleBreak: { pnlImpact: Decimal; actualExitPrice: Decimal; ruleExitPrice: Decimal | null } | null
}

function d2(v: Decimal | number | null | undefined): string {
  if (v == null) return '—'
  return new Decimal(v.toString()).toDecimalPlaces(2).toString()
}
function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

// The single source of the recomputed values — used by BOTH the printed table and
// the write, so the post-write rows equal the dry-run exactly.
function recompute(t: TradeRow) {
  const instr: InstrumentFactor | null = CONFIG[t.instrument] ?? null
  const direction = t.direction as 'LONG' | 'SHORT'
  const entryPrice = t.entryPrice.toString()
  const stopLoss = t.stopLoss.toString()
  const quantity = t.quantity.toString()
  const exitPrice = t.exitPrice != null ? t.exitPrice.toString() : null
  const idealExit = t.idealExit?.toString() ?? null
  const notTaken = t.status === 'MISSED' || t.status === 'SKIP'
  const pnlOverride = t.pnlOverride

  // newPnl: null = leave unchanged (OPEN, no exit, no override)
  let newPnl: string | null = null
  if (pnlOverride != null && exitPrice == null && !notTaken) newPnl = String(pnlOverride)
  else if (notTaken) newPnl = pnlOverride != null ? String(pnlOverride) : '0'
  else if (exitPrice != null) newPnl = computePnl(instr, { direction, entryPrice, exitPrice, quantity }, pnlOverride).toDecimalPlaces(2).toString()

  const newExec = computeExecutionPnl(instr, { direction, entryPrice, idealExit, quantity, exitPrice, notTaken }, pnlOverride)

  // newRb: null = no rule-break pnlImpact update
  let newRb: string | null = null
  if (t.ruleBreak && t.ruleBreak.ruleExitPrice != null) {
    newRb = computeRuleBreakPnlImpact(instr, {
      direction, entryPrice, stopLoss,
      actualExitPrice: t.ruleBreak.actualExitPrice.toString(),
      ruleExitPrice: t.ruleBreak.ruleExitPrice.toString(),
      quantity,
    }, pnlOverride, exitPrice).pnlImpact.toDecimalPlaces(2).toString()
  }

  // rMultiple recomputed only to PROVE it's unchanged — never persisted.
  const oldR = t.rMultiple != null ? d2(t.rMultiple) : '—'
  let newR = oldR
  if (exitPrice != null && !notTaken) {
    newR = computeRMultiple(direction, entryPrice, stopLoss, exitPrice).toDecimalPlaces(2).toString()
  }

  return { newPnl, newExec, newRb, oldR, newR }
}

function printTable(title: string, trades: TradeRow[]): number {
  console.log(`\n${title} — ${trades.length} trades\n`)
  const header =
    pad('instrument', 11) + pad('status', 8) +
    pad('pnl old→new', 22) + pad('execPnl old→new', 24) +
    pad('pnlImpact old→new', 22) + 'rMultiple old→new'
  console.log(header)
  console.log('-'.repeat(header.length))
  let rChanged = 0
  for (const t of trades) {
    const r = recompute(t)
    const oldRb = t.ruleBreak ? d2(t.ruleBreak.pnlImpact) : '—'
    const newRbDisp = t.ruleBreak ? (r.newRb ?? oldRb) : '—'
    if (r.newR !== r.oldR) rChanged++
    console.log(
      pad(t.instrument, 11) +
      pad(t.status, 8) +
      pad(`${d2(t.pnl)} → ${r.newPnl ?? '—'}`, 22) +
      pad(`${d2(t.executionPnl)} → ${d2(r.newExec)}`, 24) +
      pad(`${oldRb} → ${newRbDisp}`, 22) +
      `${r.oldR} → ${r.newR}`,
    )
  }
  console.log(`\nrMultiple values changed: ${rChanged}  (MUST be 0)`)
  return rChanged
}

const TRADE_SELECT = {
  id: true, instrument: true, status: true, direction: true,
  entryPrice: true, stopLoss: true, quantity: true, exitPrice: true, idealExit: true,
  pnl: true, executionPnl: true, rMultiple: true, pnlOverride: true,
  ruleBreak: { select: { pnlImpact: true, actualExitPrice: true, ruleExitPrice: true } },
} as const

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  const isProd = url.includes('ep-noisy-brook-aotot7c1')
  const isTest = url.includes('ep-tiny-sound-aoersa93')
  if (!isProd && !isTest) {
    throw new Error('ABORT: DATABASE_URL is neither prod nor the designated test branch.')
  }
  if (isProd) {
    if (DRY_RUN && process.env.ALLOW_PROD_DRYRUN !== '1') {
      throw new Error('ABORT: prod dry-run requires ALLOW_PROD_DRYRUN=1.')
    }
    if (!DRY_RUN && process.env.ALLOW_PROD_WRITE !== '1') {
      throw new Error('ABORT: prod WRITE requires BACKFILL_WRITE=1 AND ALLOW_PROD_WRITE=1.')
    }
  }

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) })
  const endpoint = url.match(/ep-[a-z0-9-]+/)?.[0]

  const trades = (await db.trade.findMany({
    select: TRADE_SELECT, orderBy: { createdAt: 'asc' },
  })) as unknown as TradeRow[]

  printTable(`${DRY_RUN ? 'DRY-RUN' : 'PRE-WRITE'} backfill diff on ${endpoint}`, trades)

  console.log('\nInstrument rows:')
  for (const [sym, c] of Object.entries(CONFIG)) {
    console.log(`  ${sym}: ${c.factorOp === 'DIVIDE' ? '÷' : '×'}${c.factor}  ${c.currency}  (${c.name})`)
  }

  if (DRY_RUN) {
    console.log('\nDRY-RUN: no rows written.\n')
    await db.$disconnect()
    return
  }

  // ── WRITE — one transaction; any throw rolls the whole thing back ───────────
  console.log(`\n!!! WRITE MODE — committing to ${endpoint} in one transaction !!!`)
  await db.$transaction(async (tx) => {
    const idBySymbol: Record<string, string> = {}
    for (const [sym, c] of Object.entries(CONFIG)) {
      const row = await tx.instrument.upsert({
        where: { symbol: sym },
        update: { name: c.name, factor: Number(c.factor), factorOp: c.factorOp, currency: c.currency },
        create: { symbol: sym, name: c.name, factor: Number(c.factor), factorOp: c.factorOp, currency: c.currency },
      })
      idBySymbol[sym] = row.id
    }
    for (const t of trades) {
      const r = recompute(t)
      const data: Record<string, unknown> = {
        instrumentId: idBySymbol[t.instrument] ?? null,
        executionPnl: String(r.newExec),
      }
      if (r.newPnl != null) data.pnl = r.newPnl // leave OPEN/no-exit pnl untouched
      await tx.trade.update({ where: { id: t.id }, data })
      if (r.newRb != null) {
        await tx.ruleBreak.update({ where: { tradeId: t.id }, data: { pnlImpact: r.newRb } })
      }
      // rMultiple / rMultipleImpact intentionally never in any update payload.
    }
  })
  console.log('Transaction committed.')

  // ── POST-WRITE VERIFICATION — re-query and reprint ──────────────────────────
  const after = (await db.trade.findMany({
    select: TRADE_SELECT, orderBy: { createdAt: 'asc' },
  })) as unknown as TradeRow[]
  printTable('POST-WRITE verification', after)

  const [tradeCount, instrumentCount] = await Promise.all([
    db.trade.count(),
    db.instrument.count(),
  ])
  console.log(`\nTrade rows: ${tradeCount}   Instrument rows: ${instrumentCount}\n`)

  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
