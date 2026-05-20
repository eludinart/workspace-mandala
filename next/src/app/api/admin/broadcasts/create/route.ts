import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createDraft } from '@/lib/db-broadcasts'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as {
      title?: string
      audience?: Record<string, unknown>
      channels?: Record<string, unknown>
    }
    const res = await createDraft({
      title: String(body.title ?? '').trim() || 'Annonce Mandala',
      createdByUserId: parseInt(userId, 10) || null,
      audience: body.audience as Parameters<typeof createDraft>[0]['audience'],
      channels: body.channels as Parameters<typeof createDraft>[0]['channels'],
    })
    return NextResponse.json(res)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}
