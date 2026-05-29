import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getTriggerRulesForSetup } from '@/lib/queries/playbook'
import { CreateTriggerRuleSchema } from '@/lib/validations/playbook'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const rules = await getTriggerRulesForSetup(id)
  return Response.json(rules)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: setupId } = await params
  const body = await req.json()
  const parsed = CreateTriggerRuleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await db.triggerRule.findUnique({
    where: { setupId_precedence: { setupId, precedence: parsed.data.precedence } },
  })
  if (existing) {
    return Response.json(
      { error: `Precedence ${parsed.data.precedence} already exists for this setup` },
      { status: 409 }
    )
  }

  const rule = await db.triggerRule.create({
    data: {
      setupId,
      precedence: parsed.data.precedence,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      direction: parsed.data.direction,
    },
  })
  return Response.json(rule, { status: 201 })
}
