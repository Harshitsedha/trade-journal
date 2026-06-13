/**
 * Backfill: link existing trades to Instrument rows and recompute currency PnL
 * through the per-instrument factor (lib/pnl.ts).
 *
 * DRY-RUN ONLY (current mode): computes and prints a per-trade diff and writes
 * NOTHING. It creates no Instrument rows, sets no instrumentId, updates no PnL.
 * Every value is recomputed from the RAW price legs through lib/pnl.ts — never by
 * scaling a stored value.
 *
 * Run (test branch only):
 *   DATABASE_URL=<test-pooled-url> npx tsx scripts/backfill-instrument-factor.ts
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

// Instrument config to backfill. SILVER CFD ounce ×5000; DAX40 has no special
// contract size yet → factor 1 (no-op) until you set one.
const CONFIG: Record<string, InstrumentFactor & { name: string }> = {
  SILVER: { factor: 5000, factorOp: 'MULTIPLY', name: 'Silver CFD (oz)' },
  DAX40: { factor: 1, factorOp: 'MULTIPLY', name: 'DAX 40 Index' },
}

const DRY_RUN = true // flip to false only after the diff is approved

function d2(v: Decimal | number | null | undefined): string {
  if (v == null) return '—'
  return new Decimal(v.toString()).toDecimalPlaces(2).toString()
}
function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  if (url.includes('ep-noisy-brook-aotot7c1')) {
    throw new Error('ABORT: DATABASE_URL points at the PRODUCTION endpoint. Test branch only.')
  }
  if (!url.includes('ep-tiny-sound-aoersa93')) {
    throw new Error('ABORT: DATABASE_URL is not the designated test branch (ep-tiny-sound-aoersa93).')
  }

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) })

  const trades = await db.trade.findMany({
    include: { ruleBreak: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`\nDRY-RUN backfill diff — ${trades.length} trades on ${url.match(/ep-[a-z0-9-]+/)?.[0]}\n`)
  const header =
    pad('instrument', 11) + pad('status', 8) +
    pad('pnl old→new', 22) + pad('execPnl old→new', 24) +
    pad('pnlImpact old→new', 22) + 'rMultiple old→new'
  console.log(header)
  console.log('-'.repeat(header.length))

  let rChanged = 0

  for (const t of trades) {
    const instr = CONFIG[t.instrument] ?? null
    const direction = t.direction as 'LONG' | 'SHORT'
    const entryPrice = t.entryPrice.toString()
    const stopLoss = t.stopLoss.toString()
    const quantity = t.quantity.toString()
    const exitPrice = t.exitPrice != null ? t.exitPrice.toString() : null
    const idealExit = (t as { idealExit: Decimal | null }).idealExit?.toString() ?? null
    const notTaken = t.status === 'MISSED' || t.status === 'SKIP'
    // pnlOverride present ⇒ implied-factor path; else instrument-factor path.
    const pnlOverride = (t as { pnlOverride: number | null }).pnlOverride

    // pnl — override value when set, else raw entry/exit/qty × instrument factor
    let newPnl: string
    if (pnlOverride != null && exitPrice == null && !notTaken) newPnl = String(pnlOverride)
    else if (notTaken) newPnl = pnlOverride != null ? String(pnlOverride) : '0'
    else if (exitPrice != null) newPnl = computePnl(instr, { direction, entryPrice, exitPrice, quantity }, pnlOverride).toDecimalPlaces(2).toString()
    else newPnl = '—' // OPEN, no exit, no override

    // executionPnl — from raw entry/exit/idealExit/qty (implied or instrument factor)
    const newExec = computeExecutionPnl(instr, { direction, entryPrice, idealExit, quantity, exitPrice, notTaken }, pnlOverride)

    // pnlImpact — from the rule-break's RAW legs (not the stored value)
    let oldRb: string = '—'
    let newRb: string = '—'
    if (t.ruleBreak) {
      oldRb = d2(t.ruleBreak.pnlImpact)
      if (t.ruleBreak.ruleExitPrice != null) {
        const impact = computeRuleBreakPnlImpact(instr, {
          direction, entryPrice, stopLoss,
          actualExitPrice: t.ruleBreak.actualExitPrice.toString(),
          ruleExitPrice: t.ruleBreak.ruleExitPrice.toString(),
          quantity,
        }, pnlOverride, exitPrice)
        newRb = impact.pnlImpact.toDecimalPlaces(2).toString()
      } else {
        newRb = oldRb // no rule exit → impact stays 0/unchanged
      }
    }

    // rMultiple — recompute from raw; MUST equal the stored value (never scaled)
    const oldR = t.rMultiple != null ? d2(t.rMultiple) : '—'
    let newR = oldR
    if (exitPrice != null && !notTaken) {
      newR = computeRMultiple(direction, entryPrice, stopLoss, exitPrice).toDecimalPlaces(2).toString()
    }
    if (newR !== oldR) rChanged++

    console.log(
      pad(t.instrument, 11) +
      pad(t.status, 8) +
      pad(`${d2(t.pnl)} → ${newPnl}`, 22) +
      pad(`${d2(t.executionPnl)} → ${d2(newExec)}`, 24) +
      pad(`${oldRb} → ${newRb}`, 22) +
      `${oldR} → ${newR}`,
    )
  }

  console.log('\nInstrument config used:')
  for (const [sym, c] of Object.entries(CONFIG)) {
    console.log(`  ${sym}: ${c.factorOp === 'DIVIDE' ? '÷' : '×'}${c.factor}  (${c.name})`)
  }
  console.log(`\nrMultiple values changed: ${rChanged}  (MUST be 0)`)
  console.log(DRY_RUN ? '\nDRY-RUN: no rows written.\n' : '\n!!! LIVE MODE !!!\n')

  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
