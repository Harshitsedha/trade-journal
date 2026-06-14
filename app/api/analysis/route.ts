import { NextRequest } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { getTradesForAnalysis } from '@/lib/queries/analytics'
import { assembleAnalysis } from '@/lib/analytics/compute'

const AnalysisQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  side: z.enum(['LONG', 'SHORT']).optional(),
  setupId: z.string().optional(),
  subSetupId: z.string().optional(),
  instrument: z.string().optional(),
  tagId: z.string().optional(),
  quality: z.enum(['rule_followed', 'rule_broken', 'missed']).optional(),
  currency: z.string().optional(),
  groupBy: z.enum(['setup', 'subSetup', 'instrument', 'side', 'tag', 'quality']).default('setup'),
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

  const trades = await getTradesForAnalysis(filters)

  return Response.json({
    ...assembleAnalysis(trades, groupByDim),
    currency: filterFields.currency ?? null, // active single-currency scope
  })
}
