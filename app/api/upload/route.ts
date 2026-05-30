import { NextRequest } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { generateSignedUploadParams, deleteImage } from '@/lib/cloudinary'
import { addChartImage, deleteChartImage } from '@/lib/queries/trades'

const SaveImageSchema = z.object({
  tradeId: z.string().cuid(),
  cloudinaryId: z.string().min(1),
  url: z.string().url(),
  label: z.string().max(100).optional(),
})

const DeleteImageSchema = z.object({
  imageId: z.string().cuid(),
  cloudinaryId: z.string().min(1),
})

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await generateSignedUploadParams()
  return Response.json(params)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = SaveImageSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const image = await addChartImage(
    parsed.data.tradeId,
    parsed.data.cloudinaryId,
    parsed.data.url,
    parsed.data.label
  )
  return Response.json(image, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = DeleteImageSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  await Promise.all([
    deleteImage(parsed.data.cloudinaryId),
    deleteChartImage(parsed.data.imageId),
  ])
  return new Response(null, { status: 204 })
}
