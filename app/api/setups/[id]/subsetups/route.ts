import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getSubSetupsBySetup } from '@/lib/queries/trades'
import { CreateSubSetupSchema } from '@/lib/validations/trade'
import { db } from '@/lib/db'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const subSetups = await getSubSetupsBySetup(id)
  return Response.json(subSetups)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = CreateSubSetupSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const subSetup = await db.subSetup.create({
    data: { setupId: id, name: parsed.data.name, description: parsed.data.description ?? null },
  })
  return Response.json(subSetup, { status: 201 })
}
