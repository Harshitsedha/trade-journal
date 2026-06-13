import { NextRequest } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { CreateInstrumentSchema } from '@/lib/validations/instrument'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const instruments = await db.instrument.findMany({ orderBy: { symbol: 'asc' } })
  return Response.json(instruments)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateInstrumentSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { symbol, name, factor, factorOp } = parsed.data
  try {
    const created = await db.instrument.create({
      data: { symbol: symbol.toUpperCase().trim(), name: name.trim(), factor, factorOp },
    })
    return Response.json(created, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return Response.json({ error: `Symbol "${symbol.toUpperCase().trim()}" already exists` }, { status: 409 })
    }
    throw err
  }
}
