import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { COACH_SYSTEM_PROMPT } from '@/lib/analytics/coachPrompt'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ summary: 'AI coaching is not configured (missing ANTHROPIC_API_KEY).' })
  }

  let statsPayload: unknown
  try {
    statsPayload = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        system: COACH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(statsPayload) }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Anthropic API error:', err)
      return Response.json({ summary: 'The coaching service is temporarily unavailable. Try again shortly.' })
    }

    const data = await res.json()
    const text = (data.content as { type: string; text: string }[])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    return Response.json({ summary: text })
  } catch (err) {
    console.error('Coach route error:', err)
    return Response.json({ summary: 'Unable to generate coaching summary right now.' })
  }
}
