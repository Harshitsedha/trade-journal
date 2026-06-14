import { NextRequest } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { UpdateInstrumentSchema } from '@/lib/validations/instrument'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateInstrumentSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { symbol, name, factor, factorOp, currency } = parsed.data
  try {
    const updated = await db.instrument.update({
      where: { id },
      data: {
        ...(symbol !== undefined && { symbol: symbol.toUpperCase().trim() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(factor !== undefined && { factor }),
        ...(factorOp !== undefined && { factorOp }),
        ...(currency !== undefined && { currency }),
      },
    })
    return Response.json(updated)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return Response.json({ error: 'Symbol already exists' }, { status: 409 })
      if (err.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    // FK is onDelete: SetNull — any linked trades simply revert to the factor-1
    // fallback. Their stored pnl is NOT recomputed here (a later recalc/backfill does that).
    await db.instrument.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    throw err
  }
}
