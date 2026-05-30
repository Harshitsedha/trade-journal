import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { UpdateTriggerRuleSchema } from '@/lib/validations/playbook'

type RouteContext = { params: Promise<{ id: string; ruleId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: setupId, ruleId } = await params
  const body = await req.json()
  const parsed = UpdateTriggerRuleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.precedence !== undefined) {
    const conflict = await db.triggerRule.findFirst({
      where: {
        setupId,
        precedence: parsed.data.precedence,
        id: { not: ruleId },
      },
    })
    if (conflict) {
      return Response.json(
        { error: `Precedence ${parsed.data.precedence} already exists for this setup` },
        { status: 409 }
      )
    }
  }

  const rule = await db.triggerRule.update({
    where: { id: ruleId },
    data: parsed.data,
  })
  return Response.json(rule)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ruleId } = await params
  const rule = await db.triggerRule.update({
    where: { id: ruleId },
    data: { isActive: false },
  })
  return Response.json(rule)
}
