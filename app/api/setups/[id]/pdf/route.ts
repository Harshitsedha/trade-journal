import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteImage } from '@/lib/cloudinary'
import { SetupPdfSchema } from '@/lib/validations/playbook'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = SetupPdfSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const setup = await db.setup.findUnique({
    where: { id },
    select: { pdfCloudinaryId: true },
  })
  if (!setup) return Response.json({ error: 'Not found' }, { status: 404 })

  if (setup.pdfCloudinaryId) {
    await deleteImage(setup.pdfCloudinaryId).catch(() => null)
  }

  const updated = await db.setup.update({
    where: { id },
    data: { pdfUrl: parsed.data.url, pdfCloudinaryId: parsed.data.cloudinaryId },
  })
  return Response.json(updated)
}
