import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getSetupById } from '@/lib/queries/playbook'
import { UpdateSetupSchema } from '@/lib/validations/playbook'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const setup = await getSetupById(id)
  if (!setup) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(setup)
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSetupSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const setup = await db.setup.update({
    where: { id },
    data: parsed.data,
    include: {
      triggerRules: { orderBy: { precedence: 'asc' } },
      subSetups: { orderBy: { name: 'asc' } },
      _count: { select: { trades: true } },
    },
  })
  return Response.json(setup)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.setup.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
