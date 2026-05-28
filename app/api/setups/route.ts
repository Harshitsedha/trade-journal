import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getSetups } from '@/lib/queries/trades'
import { CreateSetupSchema } from '@/lib/validations/trade'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const setups = await getSetups()
  return Response.json(setups)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSetupSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const setup = await db.setup.create({
    data: { name: parsed.data.name, description: parsed.data.description ?? null },
  })
  return Response.json(setup, { status: 201 })
}
