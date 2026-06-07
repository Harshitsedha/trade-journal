import { NextRequest } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { getTradesForAnalysis, getExecutionPnlSum } from '@/lib/queries/analytics'
import { computeStat, groupBy, cleanVsBroken, equityCurve } from '@/lib/analytics/compute'

const AnalysisQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  side: z.enum(['LONG', 'SHORT']).optional(),
  setupId: z.string().optional(),
  subSetupId: z.string().optional(),
  instrument: z.string().optional(),
  tagId: z.string().optional(),
  cleanliness: z.enum(['clean', 'broken']).optional(),
  groupBy: z.enum(['setup', 'subSetup', 'instrument', 'side', 'tag']).default('setup'),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = AnalysisQuerySchema.safeParse(params)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { groupBy: groupByDim, from, to, ...filterFields } = parsed.data

  const filters = {
    ...filterFields,
    ...(from ? { from: new Date(from) } : {}),
    ...(to ? { to: new Date(to) } : {}),
  }

  const [trades, executionPnlSum] = await Promise.all([
    getTradesForAnalysis(filters),
    getExecutionPnlSum(filters),
  ])

  const groups = groupBy(trades, groupByDim).sort(
    (a, b) => b.stat.totalPnl - a.stat.totalPnl
  )

  return Response.json({
    overall: computeStat(trades),
    groups,
    cleanVsBroken: cleanVsBroken(trades),
    equity: equityCurve(trades),
    rValues: trades.map(t => t.rMultiple),
    tradeCount: trades.length,
    executionPnlSum,
  })
}
